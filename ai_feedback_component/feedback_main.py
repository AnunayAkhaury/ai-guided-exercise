import sys
from extract_landmarks import extract_landmarks
from calculate_joint_angles import calculate_joint_angles
from analyze_ideal import generate_ideal_baseline
from analyze_form import run_form_analysis
from align_reps import align_reps
from llm_feedback import llm_generate_feedback

def generate_ideal(base_name):
    """
    Pipeline: Raw Video -> Pose JSON -> Angles JSON -> Ideal Baseline JSON
    """
    print(f"\n--- Starting Ideal Baseline Generation for: {base_name} ---")
    
    # 1. Extract Landmarks from Video
    extract_landmarks(base_name)
    
    # 2. Calculate Angles from Landmarks
    calculate_joint_angles(base_name)
    
    # 3. Analyze periodicity to create the Ideal Baseline
    generate_ideal_baseline(base_name)
    
    print(f"--- Ideal Baseline Complete: {base_name}-ideal.json ---\n")


def generate_comparison(exercise_name, test_video_name, ideal_baseline_name):
    """
    Pipeline: Raw Video -> Pose JSON -> Angles JSON -> Deviation Report -> LLM Generated Feedback
    """
    print(f"\n--- Starting Form Analysis for: {test_video_name} ---")
    print(f"--- Using Baseline: {ideal_baseline_name} ---")

    # 1. Extract Landmarks from the test video
    extract_landmarks(test_video_name)
    
    # 2. Calculate Angles for the test video
    calculate_joint_angles(test_video_name)

    # 3. Detect reps in student and instructor
    align_reps(test_video_name, ideal_baseline_name)

    # 4. Compare test angles against the specified ideal baseline
    run_form_analysis(test_video_name, ideal_baseline_name)

    # 5. Generate feedback using LLM
    result = llm_generate_feedback(exercise_name, test_video_name)

    print(f"--- Analysis Complete: {test_video_name}-bad_reps.json ---\n")

    return result

def main():
    if len(sys.argv) < 3:
        print("Usage:")
        print("  To create ideal: python main.py ideal <BaseName>")
        print("  To compare: python main.py compare <ExerciseName> <TestVideoName> <IdealBaseName>")
        print("  ***Note: <BaseName> is name of video file without .mp4 extension (all videos assumed to be mp4)")
        return

    mode = sys.argv[1].lower()
    
    if mode == "ideal":
        base_name = sys.argv[2]
        generate_ideal(base_name)
        
    elif mode == "compare":
        print(sys.argv)
        if len(sys.argv) < 5:
            print("Error: Comparison mode requires exercise name and both a Test Video name and an Ideal Baseline name.")
            return
        exercise_name = sys.argv[2]
        test_name = sys.argv[3]
        ideal_name = sys.argv[4]
        generate_comparison(exercise_name, test_name, ideal_name)
        
    else:
        print(f"Unknown mode: {mode}. Use 'ideal' or 'compare'.")

if __name__ == "__main__":
    main()