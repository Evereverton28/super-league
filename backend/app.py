from flask import Flask, jsonify, request
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)

DATA_FILE = "db.json"

def load_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

@app.route("/data", methods=["GET"])
def get_data():
    return jsonify(load_data())

@app.route("/update", methods=["POST"])
def update():
    data = request.json
    save_data(data)
    return jsonify({"status": "saved"})

if __name__ == "__main__":
    app.run(debug=True)