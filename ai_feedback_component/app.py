from flask import Flask, request, jsonify
import traceback
import io
from contextlib import redirect_stdout

from main import generate_ideal, generate_comparison

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "API is running"})

# -----------------------------
# Print Usage Details
# -----------------------------
@app.route("/usage", methods=["GET"])
def usage():
    return {
        "usage": {
            "ideal": {
                "description": "Generate ideal baseline from a video",
                "endpoint": "POST /ideal",
                "body": {
                    "ideal_name": "<IdealName>"
                },
                "example": {
                    "ideal_name": "instructor-pushup"
                }
            },
            "compare": {
                "description": "Compare test video against ideal baseline",
                "endpoint": "POST /compare",
                "body": {
                    "exercise_name": "<ExerciseName>",
                    "test_name": "<TestVideoName>",
                    "ideal_name": "<IdealBaseName>"
                },
                "example": {
                    "exercise_name": "push ups",
                    "test_name": "student-pushup",
                    "ideal_name": "instructor-pushup"
                }
            }
        },
        "note": "<BaseName> is the name of the video file without the .mp4 extension (all videos assumed to be mp4)"
    }

# -----------------------------
# Generate Ideal Endpoint
# -----------------------------
@app.route("/ideal", methods=["POST"])
def ideal():
    try:
        data = request.json
        ideal_name = data.get("ideal_name")

        if not ideal_name:
            return jsonify({"error": "Missing 'ideal_name'"}), 400

        f = io.StringIO()
        with redirect_stdout(f):
            result = generate_ideal(ideal_name)
        printed_output = f.getvalue()

        return jsonify({
            "status": "success",
            "result": result,
            "logs": printed_output
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "trace": traceback.format_exc()
        }), 500


# -----------------------------
# Compare Endpoint
# -----------------------------
@app.route("/compare", methods=["POST"])
def compare():
    try:
        data = request.json

        exercise_name = data.get("exercise_name")
        test_name = data.get("test_name")
        ideal_name = data.get("ideal_name")

        if not all([exercise_name, test_name, ideal_name]):
            return jsonify({
                "error": "Missing required fields: exercise_name, test_name, ideal_name"
            }), 400

        f = io.StringIO()
        with redirect_stdout(f):
            result = generate_comparison(exercise_name, test_name, ideal_name)
        printed_output = f.getvalue()

        return jsonify({
            "status": "success",
            "result": result,
            "logs": printed_output
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "trace": traceback.format_exc()
        }), 500

# -----------------------------
# Run server
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)