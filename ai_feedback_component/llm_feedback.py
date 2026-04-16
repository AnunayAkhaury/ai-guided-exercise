import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List

class RepetitionFeedback(BaseModel):
    timestamp_start: int = Field(description="Start timestamp of grouped reps")
    timestamp_end: int = Field(description="End timestamp of grouped reps")
    feedback: str = Field(description="Feedback in few words")

class OutputFeedback(BaseModel):
    repetition_feedbacks: List[RepetitionFeedback]
    summary: str = Field(description="Summary less than 2 sentences")
    score: int = Field(
        description="A score out of 10 for overall form",
        ge=1,
        le=10
    )

def llm_generate_feedback(exercise_name, base_name, data_dir="/app/data"):

    bad_reps_file_path = os.path.join(data_dir, f"{base_name}-bad-reps.json")

    client = genai.Client()
    
    prompt = f"""
    You are given a JSON containing frame-by-frame discrepancies between a student’s {exercise_name} form and an ideal reference.
    Generate concise, actionable feedback on how the student can improve their form.
    Additionally generate a summary for the feedback, which is motivating and highlights benefits of improving form.

    Group feedback by rep number, and combine frames into a single feedback point if they are consecutive in time and describe the same problem.
    Make sure the final groupings do not overlap.

    Keep feedback focused on key movement problems rather than listing every frame individually.

    Rules:
    - Use simple everyday language
    - No anatomy or biomechanics terms (no “flexion”, “extension”, “activation”, “stability”)
    - No gym jargon (no “lockout”, “peak contraction”, “engage core”)
    - Use direct instructions like “keep your body straight”, “bend your elbows more”
    - Keep each feedback under 2 short sentences
    """

    with open(bad_reps_file_path, "r") as f:
        json_data = json.load(f)
        json_str = json.dumps(json_data, indent=2)

        print("LLM generating feedback...")
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text=prompt),
                        types.Part(text=json_str)
                    ]
                )
            ],
            config={
                "response_mime_type": "application/json",
                "response_json_schema": OutputFeedback.model_json_schema(),
            },
        )

    print(response.text)
    return response.text