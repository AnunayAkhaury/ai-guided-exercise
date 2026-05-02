import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.signal import find_peaks, butter, filtfilt
import os
import json

class DeepCycleCounter:
    def __init__(self, joints, fps=30):
        self.joints = joints
        self.fps = fps
        self.butterworth_freq = 0.8
    

    def load_json_to_df(self, json_path, drop_unusable=True):
        with open(json_path, 'r') as f:
            data = json.load(f)
        
        frames_list = []
        total_frames = data.get("totalFrames", 0)
        
        # Parse frames into a list of dicts
        for f_data in data['frames']:
            row = {"frameIndex": f_data['frameIndex']}
            for joint in self.joints:
                # Drop unusable data
                is_usable = f_data.get("usableDict", {}).get(joint, False)
                angle = f_data.get("angles", {}).get(joint, np.nan)
                
                if drop_unusable and not is_usable:
                    row[joint] = np.nan
                else:
                    row[joint] = angle
            frames_list.append(row)

        df = pd.DataFrame(frames_list)
        
        # Create a full index from 0 to totalFrames to preserve timing
        full_idx = pd.DataFrame({"frameIndex": range(total_frames)})
        df = pd.merge(full_idx, df, on="frameIndex", how="left")
        df.set_index("frameIndex", inplace=True)

        return df


    def preprocess(self, df, is_inst=False):
        df = df.copy()

        # Keep the heavy smoothing (0.8Hz) to keep the "Big Picture" clear
        def butter_lowpass_filter(data, cutoff=self.butterworth_freq, order=4):
            nyq = 0.5 * self.fps
            normal_cutoff = cutoff / nyq
            b, a = butter(order, normal_cutoff, btype='low', analog=False)
            return filtfilt(b, a, data)

        if is_inst:
            inst_periods = []
            for col in self.joints:
                if col in df.columns:
                    signal = df[col].interpolate().ffill().bfill().values.astype(float)

                    # 1. Get a rough period estimate using a high-frequency pass
                    rough_signal = butter_lowpass_filter(signal, cutoff=2.5)
                    rough_period = self.estimate_period_autocorr(rough_signal)
                        
                    # 2. Determine if movement is "Fast" or "Slow"
                    # If period is less than 40 frames (approx 1.3s at 30fps)
                    if rough_period > 0:
                        inst_periods.append(rough_period)
            
            if not inst_periods:
                print("No periodic movement found in instructor.")
                return df

            inst_period = int(np.max(inst_periods))
            if inst_period < (self.fps * 1.3):
                current_cutoff = 2.5  # Fast (Mountain Climbers, Jumping Jacks)
            else:
                current_cutoff = 0.8  # Slow (Squats, Lunges, Pushups)
                    
            self.butterworth_freq = current_cutoff
                    
            # 3. Apply the final filter
            df[col] = butter_lowpass_filter(signal)
        else:
            for col in self.joints:
                if col in df.columns:
                    signal = df[col].interpolate().ffill().bfill().values.astype(float)
                    signal = butter_lowpass_filter(signal)
                    df[col] = signal
                    
        return df


    def estimate_period_autocorr(self, signal):
        # 1. Center the signal
        sig_centered = signal - np.mean(signal)
        
        # 2. Compute autocorrelation
        corr = np.correlate(sig_centered, sig_centered, mode='full')
        corr = corr[len(corr)//2:]
        
        # 3. Normalize the correlation (so the peak at lag 0 is 1.0)
        # This is critical for defining a "confidence" threshold
        if corr[0] == 0: return 0
        corr = corr / corr[0]

        # Define search bounds
        min_lag = int(self.fps * 0.2) 
        max_lag = int(self.fps * 10.0)
        
        search_region = corr[min_lag:max_lag]
        if len(search_region) == 0: return 0

        # 4. Find peaks in the normalized search region
        peaks, props = find_peaks(search_region, height=0)
        
        if len(peaks) > 0:
            # Get the height of the strongest peak
            best_idx = np.argmax(props['peak_heights'])
            peak_height = props['peak_heights'][best_idx]
            
            # --- CONFIDENCE THRESHOLD ---
            # 0.4 is a common threshold. If the peak is lower than this, 
            # the repetition is too weak/inconsistent to trust.
            confidence_threshold = 0.4 
            
            if peak_height < confidence_threshold:
                return 0 # Low confidence
                
            return peaks[best_idx] + min_lag
            
        return 0 # No peaks found


    def analyze(self, inst_df, stud_df):        
        joint_results = []

        joint_candidates = []
        filtered_joints = []

        # 1. Collect periods and confidence scores for all joints
        for joint in self.joints:
            if joint not in inst_df.columns or joint not in stud_df.columns:
                continue
            
            # Get period and the peak height (confidence) from instructor
            p_inst = self.estimate_period_autocorr(inst_df[joint].values)
            p_stud = self.estimate_period_autocorr(stud_df[joint].values)

            if p_inst > 0 and p_stud > 0:
                joint_candidates.append({
                    "joint": joint,
                    "p_inst": p_inst,
                    "p_stud": p_stud,
                })
                filtered_joints.append(joint)

        if not joint_candidates:
            print("No matching rhythmic joints found between student and instructor.")
            return []

        # 2. Sort by joints based on which one aludes to the dominant rhythm period
        # We use the largest instructor period as the anchor
        joint_candidates.sort(key=lambda x: x['p_inst'], reverse=True)
        
        inst_period = int(joint_candidates[0]['p_inst'])
        stud_period = int(joint_candidates[0]['p_stud'])

        for joint in filtered_joints:
            if joint not in inst_df.columns or joint not in stud_df.columns:
                continue

            inst_sig = inst_df[joint].values
            stud_sig = stud_df[joint].values

            # 2. Extract Template from Instructor
            # We normalize the shape of the instructor's movement
            best_start = 0
            best_score = -np.inf
            for i in range(len(inst_sig) - 2 * inst_period):
                seg1 = inst_sig[i : i + inst_period]
                seg2 = inst_sig[i + inst_period : i + 2 * inst_period]
                score = np.corrcoef(seg1, seg2)[0, 1]
                if score > best_score:
                    best_score = score
                    best_start = i
            
            template = inst_sig[best_start : best_start + inst_period]
            
            # 3. Rough Matching
            # We slide a window across the student signal to find their reps
            scores = []
            for i in range(len(stud_sig) - stud_period):
                window = stud_sig[i : i + stud_period] # window should match the size of student period
                if np.std(window) < 0.1:
                    scores.append(0)
                    continue
                
                # Check correlation: This compares the student's window against 
                # a stretched version of the instructor's template
                # (Simple linear stretch to handle different speeds)
                resampled_template = np.interp(
                    np.linspace(0, 1, stud_period), 
                    np.linspace(0, 1, inst_period), 
                    template
                )
                
                t_norm = (resampled_template - np.mean(resampled_template)) / (np.std(resampled_template) + 1e-6)
                w_norm = (window - np.mean(window)) / (np.std(window) + 1e-6)
                
                score = np.corrcoef(t_norm, w_norm)[0, 1]
                scores.append(score)

            scores = np.array(scores)

            # 4. Peak detection with the student's actual tempo
            peaks, _ = find_peaks(
                scores, 
                height=max(0.3, np.max(scores) * 0.5), 
                distance=int(stud_period * 0.8)
            )

            # 5. Graphing to visualize results
            plt.figure(figsize=(15, 5))
            plt.subplot(1, 2, 1)
            plt.plot(stud_sig, label='Student Signal', linewidth=2)
            
            for p in peaks:
                plt.axvspan(p, p + stud_period, color='green', alpha=0.2)
            
            plt.title(f"{joint}: Full Reps Detected = {len(peaks)}")
            plt.legend(["Signal", "Rep Boundary"])

            plt.subplot(1, 2, 2)
            plt.plot(scores, color='tab:blue')
            plt.scatter(peaks, scores[peaks], color='red')
            plt.axhline(y=max(0.3, np.max(scores) * 0.5), color='r', linestyle='--')
            plt.title(f"Similarity Score (Template stretched to {stud_period} frames)")
            plt.show()

            to_ms = lambda f: round((f / self.fps) * 1000, 2)

            joint_results.append({
                "joint": joint,
                "inst_period_frames": inst_period,
                "stud_period_frames": stud_period,
                "template_start_frame": best_start,
                "template_start_ms": to_ms(best_start),
                "template_end_ms": to_ms(best_start + inst_period),
                "peaks_frames": peaks.tolist()
            })
        
        return joint_results


def align_reps(base_name, ideal_base_name, data_dir="./data"):
    imp_joints_path = os.path.join(data_dir, f"{ideal_base_name}-imp-joints.json")
    baseline_path = os.path.join(data_dir, f"{ideal_base_name}-angles.json")
    input_path    = os.path.join(data_dir, f"{base_name}-angles.json")
    output_path   = os.path.join(data_dir, f"{base_name}-rep-boundaries.json")
    
    if not os.path.exists(imp_joints_path):
        print(f"Baseline file not found: {imp_joints_path}")
        return
    if not os.path.exists(baseline_path):
        print(f"Important joints file not found: {baseline_path}")
        return
    if not os.path.exists(input_path):
        print(f"Input angles file not found: {input_path}")
        return

    with open(imp_joints_path, 'r') as file:
        imp_joints = json.load(file)["primary_joints"]
    
    counter = DeepCycleCounter(imp_joints)
    
    inst_df = counter.preprocess(counter.load_json_to_df(baseline_path, drop_unusable=False), is_inst=True)
    stud_df = counter.preprocess(counter.load_json_to_df(input_path, drop_unusable=True))

    joint_results = counter.analyze(inst_df, stud_df)

    if not joint_results: return

    # Timing Constants
    fps = counter.fps
    to_ms = lambda f: round((f / fps) * 1000, 2)
    stud_period = joint_results[0]["stud_period_frames"]
    num_joints = len(joint_results)

    # 1. Consensus Peak Clustering (Modified to track source joint)
    all_peaks = []
    for r in joint_results: 
        for p in r["peaks_frames"]:
            all_peaks.append({"frame": p, "result": r})
    
    # Sort by frame index
    all_peaks.sort(key=lambda x: x["frame"])
    
    clusters = []
    if len(all_peaks) > 0:
        curr_cluster = [all_peaks[0]]
        tol = int(0.4 * stud_period)

        for i in range(1, len(all_peaks)):
            p_val = all_peaks[i]["frame"]
            if p_val - np.mean([x["frame"] for x in curr_cluster]) <= tol:
                curr_cluster.append(all_peaks[i])
            else:
                unique_joints = len(set([x["result"]["joint"] for x in curr_cluster]))
                if unique_joints / num_joints >= 0.5:
                    # Save the cluster with the joint result that is closest to the mean
                    mean_frame = np.mean([x["frame"] for x in curr_cluster])
                    best_match = min(curr_cluster, key=lambda x: abs(x["frame"] - mean_frame))
                    clusters.append(best_match)
                curr_cluster = [all_peaks[i]]
        
        # Process the last cluster
        unique_joints = len(set([x["result"]["joint"] for x in curr_cluster]))
        if (unique_joints / num_joints) >= 0.5:
            mean_frame = np.mean([x["frame"] for x in curr_cluster])
            best_match = min(curr_cluster, key=lambda x: abs(x["frame"] - mean_frame))
            clusters.append(best_match)

    # 2. Final Overlap Cleanup
    final_reps = []
    if clusters:
        clusters.sort(key=lambda x: x["frame"])
        final_reps.append(clusters[0])
        for i in range(1, len(clusters)):
            if clusters[i]["frame"] - final_reps[-1]["frame"] >= int(stud_period * 0.9):
                final_reps.append(clusters[i])

    # 3. Prepare Final Output (Linking specific joint to instructor template)
    student_reps = []
    for i, rep in enumerate(final_reps):
        s = rep["frame"]
        # The specific joint result that defined this cluster
        source_joint = rep["result"] 
        
        rep_entry = {
            "rep_index": i + 1,
            "student_boundary": {
                "start_frame": s,
                "end_frame": s + stud_period,
                "start_ms": to_ms(s),
                "end_ms": to_ms(s + stud_period)
            },
            "instructor_template": {
                "joint": source_joint["joint"], # The joint that defined this specific boundary
                "start_frame": source_joint["template_start_frame"],
                "end_frame": source_joint["template_start_frame"] + source_joint["inst_period_frames"],
                "start_ms": source_joint["template_start_ms"],
                "end_ms": source_joint["template_end_ms"]
            },
            "confidence": "high"
        }
        student_reps.append(rep_entry)

    output = {
        "metadata": {
            "fps": fps, 
            "total_reps": len(student_reps)
        },
        "student_reps": student_reps
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Analysis saved with {len(student_reps)} reps. Each paired with instructor template.")
