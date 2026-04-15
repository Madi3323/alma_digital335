import os
import hashlib
import sqlite3
from flask import Flask, request, jsonify, session, render_template, g

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "alma-digital-secret-2024")

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "alma.db")


# ─── DATABASE ─────────────────────────────────

def get_db():
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db:
        db.close()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)

    # USERS
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            tariff TEXT DEFAULT 'free',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # NEWS
    conn.execute("""
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            text TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ORDERS (ЗАЯВКИ)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # seed news
    cur = conn.execute("SELECT COUNT(*) FROM news")
    if cur.fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO news (title, text) VALUES (?, ?)",
            [
                ("Alma Digital запущен", "Добро пожаловать в платформу"),
                ("Тариф Pro", "Новые возможности доступны"),
                ("Обновление системы", "Улучшена безопасность"),
            ]
        )

    conn.commit()
    conn.close()


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


# ─── PAGES ─────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/cabinet")
def cabinet():
    return render_template("cabinet.html")


@app.route("/news")
def news_page():
    return render_template("news.html")


# ─── AUTH ─────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Заполните все поля"}), 400

    if len(password) < 6:
        return jsonify({"error": "Пароль минимум 6 символов"}), 400

    db = get_db()

    if db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
        return jsonify({"error": "Email уже используется"}), 409

    db.execute(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        (name, email, hash_password(password))
    )
    db.commit()

    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    session["user_id"] = user["id"]

    return jsonify({"id": user["id"], "name": user["name"]})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()

    if not user or user["password"] != hash_password(password):
        return jsonify({"error": "Неверный логин или пароль"}), 401

    session["user_id"] = user["id"]
    return jsonify({"id": user["id"], "name": user["name"]})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Не авторизован"}), 401

    db = get_db()
    user = db.execute(
        "SELECT id, name, email, tariff, created_at FROM users WHERE id=?",
        (user_id,)
    ).fetchone()

    return jsonify(dict(user))


# ─── ORDERS (ЗАЯВКИ) ─────────────────────────────────

@app.route("/api/orders", methods=["POST"])
def create_order():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    title = data.get("title")
    amount = data.get("amount", 0)

    if not title:
        return jsonify({"error": "Введите название"}), 400

    db = get_db()
    db.execute(
        "INSERT INTO orders (user_id, title, amount) VALUES (?, ?, ?)",
        (user_id, title, amount)
    )
    db.commit()

    return jsonify({"ok": True})


@app.route("/api/orders", methods=["GET"])
def get_orders():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    rows = db.execute(
        "SELECT * FROM orders WHERE user_id=? ORDER BY id DESC",
        (user_id,)
    ).fetchall()

    return jsonify([dict(r) for r in rows])


# ─── NEWS ─────────────────────────────────

@app.route("/api/news")
def api_news():
    db = get_db()
    rows = db.execute("SELECT * FROM news ORDER BY created_at DESC").fetchall()
    return jsonify([dict(r) for r in rows])


# ─── START ─────────────────────────────────

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

