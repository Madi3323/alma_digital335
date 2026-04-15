import os
import hashlib
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, session, render_template, g

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "alma-digital-secret-2024")

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "alma.db")


def get_db():
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db:
        db.close()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            tariff TEXT DEFAULT 'free',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor = conn.execute("SELECT COUNT(*) FROM news")
    if cursor.fetchone()[0] == 0:
        seed_news = [
            ("Alma Digital Launches", "We are excited to announce the launch of Alma Digital, your all-in-one digital platform for managing services, orders, and more.", "2024-11-01"),
            ("New Pro Features Available", "Pro plan users now get access to advanced analytics, priority support, and unlimited storage. Upgrade today to unlock your full potential.", "2024-11-10"),
            ("Elite Tier Announced", "Introducing Alma Elite — our most powerful offering yet. Get dedicated account management, custom integrations, and SLA guarantees.", "2024-11-20"),
            ("Mobile App Coming Soon", "Our team is hard at work building the Alma Digital mobile app. Sign up for early access and be the first to try it.", "2024-12-01"),
            ("Security Upgrade Complete", "We have completed a full security audit and upgraded our infrastructure. Your data is safer than ever with end-to-end encryption.", "2024-12-15"),
        ]
        conn.executemany("INSERT INTO news (title, text, created_at) VALUES (?, ?, ?)", seed_news)
    conn.commit()
    conn.close()


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/cabinet")
def cabinet():
    return render_template("cabinet.html")


@app.route("/news")
def news_page():
    return render_template("news.html")


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        return jsonify({"error": "Email already registered"}), 409

    db.execute(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        (name, email, hash_password(password))
    )
    db.commit()

    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    session["user_id"] = user["id"]
    return jsonify({"id": user["id"], "name": user["name"], "tariff": user["tariff"]}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user or user["password"] != hash_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    session["user_id"] = user["id"]
    return jsonify({"id": user["id"], "name": user["name"], "tariff": user["tariff"]})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthenticated"}), 401
    db = get_db()
    user = db.execute("SELECT id, name, email, tariff, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        session.clear()
        return jsonify({"error": "Unauthenticated"}), 401
    return jsonify(dict(user))


@app.route("/api/news")
def api_news():
    db = get_db()
    rows = db.execute("SELECT * FROM news ORDER BY created_at DESC").fetchall()
    return jsonify([dict(r) for r in rows])


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

init_db()
@app.route("/api/orders", methods=["POST"])
def create_order():
    if "uid" not in session:
        return {"error": "Unauthorized"}, 401

    data = request.json
    title = data.get("title")
    amount = data.get("amount", 0)

    if not title:
        return {"error": "Введите название"}, 400

    with db() as conn:
        conn.execute(
            "INSERT INTO orders (user_id, title, amount) VALUES (?, ?, ?)",
            (session["uid"], title, amount)
        )

    return {"ok": True}
if __name__ == "__main__":
    init_db()

@app.route("/api/create-order", methods=["POST"])
@login_required
def create_order():
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    amount = float(data.get("amount") or 0)

    if not title:
        return jsonify({"error": "Введите название заявки"}), 400

    with get_db() as conn:
        conn.execute(
            "INSERT INTO orders (user_id, title, amount) VALUES (?, ?, ?)",
            (session["user_id"], title, amount)
        )

    return jsonify({"ok": True})

