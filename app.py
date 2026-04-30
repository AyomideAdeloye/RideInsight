from flask import Flask, render_template, request, jsonify
import sqlite3

app = Flask(__name__)

DB_NAME = "rideinsight.db"


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            car TEXT,
            time TEXT,
            title TEXT,
            body TEXT,
            likes INTEGER,
            image TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS garage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT,
            year TEXT,
            make TEXT,
            model TEXT,
            trim TEXT,
            image TEXT,
            notes TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS mods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            car_id INTEGER,
            name TEXT,
            cost REAL,
            category TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            username TEXT,
            body TEXT
        )
    """)

    existing_posts = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]

    if existing_posts == 0:
        sample_posts = [
        (
            "MazdaOwner",
            "2018 Mazda 6 Touring",
            "2h ago",
            "Worth modding or upgrading?",
            "I love the reliability, but the infotainment system has been giving me problems.",
            12,
            "https://upload.wikimedia.org/wikipedia/commons/7/7f/2018_Mazda6_Sport_NAV_2.5_Front.jpg"
        ),
        (
            "CarTalkDaily",
            "2020 Honda Civic Sport",
            "5h ago",
            "Best first project car under $8,000?",
            "Looking for something reliable, fun, and easy to work on.",
            34,
            "https://upload.wikimedia.org/wikipedia/commons/2/27/2020_Honda_Civic_Sport_front_3.29.20.jpg"
        ),
        (
            "BikeGuy",
            "Yamaha R6",
            "1d ago",
            "Motorcycle vs used sports car?",
            "Trying to compare cost, maintenance, insurance, and fun factor.",
            21,
            "https://upload.wikimedia.org/wikipedia/commons/0/06/Yamaha_YZF-R6.jpg"
        )
            ]

        conn.executemany("""
            INSERT INTO posts (username, car, time, title, body, likes, image)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, sample_posts)
        

    conn.commit()
    conn.close()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/get_posts", methods=["GET"])
def get_posts():
    conn = get_db_connection()

    posts = conn.execute("""
        SELECT * FROM posts
        ORDER BY id DESC
    """).fetchall()

    conn.close()

    posts_list = []

    for post in posts:
        posts_list.append({
            "id": post["id"],
            "username": post["username"],
            "car": post["car"],
            "time": post["time"],
            "title": post["title"],
            "body": post["body"],
            "likes": post["likes"],
            "image": post["image"]
        })

    return jsonify(posts_list)


@app.route("/add_post", methods=["POST"])
def add_post():
    data = request.json

    conn = get_db_connection()

    conn.execute("""
        INSERT INTO posts (username, car, time, title, body, likes, image)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        data["username"],
        data["car"],
        "just now",
        data["title"],
        data["body"],
        0,
        data["image"]
    ))

    conn.commit()
    conn.close()

    return jsonify({"message": "Post added successfully"})

@app.route("/like_post/<int:post_id>", methods=["POST"])
def like_post(post_id):
    conn = get_db_connection()

    conn.execute("""
        UPDATE posts
        SET likes = likes + 1
        WHERE id = ?
    """, (post_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "Post liked"})

@app.route("/garage")
def garage():
    return render_template("garage.html")

@app.route("/garage")
def garage_page():
    return render_template("garage.html")


@app.route("/get_garage", methods=["GET"])
def get_garage():
    conn = get_db_connection()

    cars = conn.execute("""
        SELECT * FROM garage
        ORDER BY id DESC
    """).fetchall()

    conn.close()

    garage_list = []

    for car in cars:
        garage_list.append({
            "id": car["id"],
            "owner": car["owner"],
            "year": car["year"],
            "make": car["make"],
            "model": car["model"],
            "trim": car["trim"],
            "image": car["image"],
            "notes": car["notes"]
        })

    return jsonify(garage_list)


@app.route("/add_car", methods=["POST"])
def add_car():
    data = request.json

    conn = get_db_connection()

    conn.execute("""
        INSERT INTO garage (owner, year, make, model, trim, image, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        data["owner"],
        data["year"],
        data["make"],
        data["model"],
        data["trim"],
        data["image"],
        data["notes"]
    ))

    conn.commit()
    conn.close()

    return jsonify({"message": "Car added successfully"})

@app.route("/get_mods/<int:car_id>")
def get_mods(car_id):
    conn = get_db_connection()

    mods = conn.execute("""
        SELECT * FROM mods WHERE car_id = ?
    """, (car_id,)).fetchall()

    conn.close()

    return jsonify([dict(mod) for mod in mods])


@app.route("/add_mod", methods=["POST"])
def add_mod():
    data = request.json

    conn = get_db_connection()

    conn.execute("""
        INSERT INTO mods (car_id, name, cost, category)
        VALUES (?, ?, ?, ?)
    """, (
        data["car_id"],
        data["name"],
        data["cost"],
        data["category"]
    ))

    conn.commit()
    conn.close()

    return jsonify({"message": "Mod added"})

@app.route("/get_comments/<int:post_id>")
def get_comments(post_id):
    conn = get_db_connection()

    comments = conn.execute("""
        SELECT * FROM comments
        WHERE post_id = ?
        ORDER BY id ASC
    """, (post_id,)).fetchall()

    conn.close()

    return jsonify([dict(comment) for comment in comments])


@app.route("/add_comment", methods=["POST"])
def add_comment():
    data = request.json

    conn = get_db_connection()

    conn.execute("""
        INSERT INTO comments (post_id, username, body)
        VALUES (?, ?, ?)
    """, (
        data["post_id"],
        data["username"],
        data["body"]
    ))

    conn.commit()
    conn.close()

    return jsonify({"message": "Comment added"})

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
