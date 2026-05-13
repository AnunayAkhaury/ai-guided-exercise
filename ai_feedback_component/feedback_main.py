import sys
from extract_landmarks import extract_landmarks
from calculate_joint_angles import calculate_joint_angles
from analyze_ideal import generate_ideal_baseline
from analyze_form import run_form_analysis
from align_reps import align_reps
from primary_joints import generate_primary_joints
from llm_feedback import llm_generate_feedback
from pathlib import Path

def generate_ideal(video_file, json_dir):
    """
    Pipeline: Raw Video -> Pose JSON -> Angles JSON -> Ideal Baseline JSON
    """
    print(f"\n--- Starting Ideal Baseline Generation for: {video_file} ---")

    # 1. Extract Landmarks from Video
    extract_landmarks(video_file, json_dir)
    
    # 2. Calculate Angles from Landmarks
    calculate_joint_angles(json_dir)
    
    # 3. Analyze periodicity to create the Ideal Baseline
    generate_ideal_baseline(video_file, json_dir)

    # 4. Write primary joints file
    generate_primary_joints(video_file, json_dir)

    print(f"--- Ideal Baseline Complete: {video_file}-ideal.json ---\n")

def generate_comparison(exercise_name, video_file, json_dir):
    """
    Pipeline: Raw Video -> Pose JSON -> Angles JSON -> Deviation Report -> LLM Generated Feedback
    """
    print(f"\n--- Starting Form Analysis for: {video_file} ---")
    print(f"--- Using Baselines: {exercise_name}-ideal.json and {exercise_name}-imp-joints.json ---")

    # 1. Extract Landmarks from the test video
    extract_landmarks(video_file, json_dir)
    
    # 2. Calculate Angles for the test video
    calculate_joint_angles(json_dir)

    # 3. Detect reps in student and instructor
    align_reps(json_dir, exercise_name)

    # 4. Compare test angles against the specified ideal baseline
    run_form_analysis(json_dir, exercise_name)

    # 5. Generate feedback using LLM
    result = llm_generate_feedback(exercise_name, json_dir)

    print(f"--- Analysis Complete: {video_file}-bad_reps.json ---\n")

    return result

def print_usage():
    print("Usage:")
    print("  To create ideal: python main.py ideal [ExerciseName] [IdealVideoPath]")
    print("  To compare: python main.py compare [ExerciseName] [TestVideoPath]")
    print("  ***Note: Make sure the exercise name used in both ideal and compare pipeline matches")

def main():
    if len(sys.argv) < 3:
        print_usage()
        return

    mode = sys.argv[1].lower()
    
    if mode == "ideal":
        if len(sys.argv) < 4:
            print("Missing one of the following: [ExerciseName] [IdealVideoPath]")
            print_usage()
            return
        exercise_name = sys.argv[2]
        video_file = sys.argv[3]
        json_dir = Path('./ideals')
        json_dir = json_dir / exercise_name
        json_dir.mkdir(parents=True, exist_ok=True)
        generate_ideal(video_file, json_dir)
        
    elif mode == "compare":
        print(sys.argv)
        if len(sys.argv) < 4:
            print("Missing one of the following: [ExerciseName] [TestVideoPath]")
            print_usage()
            return
        exercise_name = sys.argv[2]
        test_name = sys.argv[3]
        json_dir = Path('./tests')
        json_dir.mkdir(parents=True, exist_ok=True)
        generate_comparison(exercise_name, test_name, json_dir)
        
    else:
        print(f"Unknown mode: {mode}. Use 'ideal' or 'compare'.")
        print_usage()

if __name__ == "__main__":
    main()