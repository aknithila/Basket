import os
import json
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')

HIGHSCORE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'highscore.json')


def read_highscore():
    if not os.path.exists(HIGHSCORE_FILE):
        return 0
    try:
        with open(HIGHSCORE_FILE, 'r') as f:
            data = json.load(f)
            return data.get('highscore', 0)
    except (json.JSONDecodeError, IOError, KeyError):
        return 0


def write_highscore(score):
    try:
        with open(HIGHSCORE_FILE, 'w') as f:
            json.dump({'highscore': score}, f, indent=4)
        return True
    except IOError:
        return False


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/highscore', methods=['GET'])
def get_highscore():
    score = read_highscore()
    return jsonify({'highscore': score})


@app.route('/highscore', methods=['POST'])
def save_highscore():
    data = request.get_json() or {}
    new_score = data.get('score')
    if new_score is None:
        return jsonify({'error': 'Missing score parameter'}), 400

    try:
        new_score = int(new_score)
    except ValueError:
        return jsonify({'error': 'Score must be an integer'}), 400

    current_high = read_highscore()
    if new_score > current_high:
        write_highscore(new_score)
        current_high = new_score

    return jsonify({'highscore': current_high})


import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

if __name__ == '__main__':
    # Initialize the highscore.json file if it doesn't exist
    if not os.path.exists(HIGHSCORE_FILE):
        write_highscore(0)
    
    port = 5000
    if is_port_in_use(port):
        print(f"\n[WARNING] Port {port} is in use (often by macOS AirPlay Receiver).")
        port = 5001
        print(f"Starting server on http://localhost:{port} instead!\n")
    else:
        print(f"Starting server on http://localhost:{port}...")
        
    app.run(host='0.0.0.0', port=port, debug=True)


