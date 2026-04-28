from extract_landmarks import extract_landmarks
from calculate_joint_angles import calculate_joint_angles
from analyze_form import run_form_analysis
from llm_feedback import llm_generate_feedback

def generate_comparison(exercise_name, video_file, ideal_file, json_dir):
    """
    Pipeline: Raw Video -> Pose JSON -> Angles JSON -> Deviation Report -> LLM Generated Feedback
    """
    print(f"\n--- Starting Form Analysis for: {video_file} ---")
    print(f"--- Using Baseline: {ideal_file} ---")

    # 1. Extract Landmarks from the test video
    extract_landmarks(video_file, json_dir)
    
    # 2. Calculate Angles for the test video
    calculate_joint_angles(video_file, json_dir)
    
    # 3. Compare test angles against the specified ideal baseline
    run_form_analysis(video_file, ideal_file, json_dir)

    # 4. Generate feedback using LLM
    result = llm_generate_feedback(exercise_name, json_dir)

    print(f"--- Analysis Complete: {video_file}-bad_reps.json ---\n")
    return result