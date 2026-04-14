import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List

class RepetitionFeedback(BaseModel):
    repetition_num: int = Field(description="The repetition number feedback is for")
    feedback: str = Field(description="Concise feedback for the reptition.")

class OutputFeedback(BaseModel):
    exercise_name: str = Field(description="Exercise name as stated in prompt.")
    repetition_feedbacks: List[RepetitionFeedback]
    score: int = Field(
        description="A score out of 10 for overall form",
        ge=1,
        le=10
    )

def llm_generate_feedback(exercise_name, base_name, data_dir="/app/data"):

    bad_reps_file_path = os.path.join(data_dir, f"{base_name}-bad-reps.json")

    client = genai.Client()
    prompt = f"Based on the following JSON describing incorrectly performed {exercise_name} reptitions, identify the errors of each rep and create one repetition feedback entry per repetition."
    
    with open(bad_reps_file_path, "r") as f:
        json_data = json.load(f)
        json_str = json.dumps(json_data, indent=2)

        print("LLM generating feedback...")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
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