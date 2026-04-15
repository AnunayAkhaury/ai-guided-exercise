from google import genai
from pydantic import BaseModel, Field
from typing import List
import sys
import json

ASSETS_DIR  = "../src/assets/images" # relative to scripts
video_name  = sys.argv[1] if len(sys.argv) >= 2 else "GoodFormCurls"
input_path = f"{ASSETS_DIR}/{video_name}-bad_reps.json"
output_path = f"{ASSETS_DIR}/{video_name}-feedback.json"

GEMINI_API_KEY = ""

class Feedback(BaseModel):
    timestampStart: int = Field(description="First timestamp ms of grouped reps")
    timestampEnd: int = Field(description="Last timestamp ms of grouped reps")
    feedback: str = Field(description="Feedback in few words")

class Response(BaseModel):
    data: List[Feedback]
    summary: str = Field(description="Summary less than 2 sentences")

client = genai.Client(api_key=GEMINI_API_KEY)

with open(input_path, 'r') as file:
    data_string = file.read()

prompt = f"""
You are given a JSON containing frame-by-frame discrepancies between a student’s pushup form and an ideal reference.
Generate concise, actionable feedback on how the student can improve their form. And generate a summary of feedback which is motivating or highlights benefits of improving form.

Group feedback by rep number, and combine frames into a single feedback point if they are consecutive in time and describe the same problem.
Make sure the final groupings do not overlap.

Keep feedback focused on key movement problems rather than listing every frame individually.

Rules:
- Use simple everyday language
- No anatomy or biomechanics terms (no “flexion”, “extension”, “activation”, “stability”)
- No gym jargon (no “lockout”, “peak contraction”, “engage core”)
- Use direct instructions like “keep your body straight”, “bend your elbows more”
- Keep each feedback under 2 short sentences

{data_string}
"""

response = client.models.generate_content(
    model="gemini-3-flash-preview", contents=prompt,
    config={
        "response_mime_type": "application/json",
        "response_json_schema": Response.model_json_schema(),
    },
)

res = Response.model_validate_json(response.text)
print(res)
data = json.loads(response.text)

with open(output_path, 'w') as f:
    json.dump(data, f, indent=4)
