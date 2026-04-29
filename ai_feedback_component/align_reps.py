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


    def preprocess(self, df):
        df = df.copy()

        # Keep the heavy smoothing (0.8Hz) to keep the "Big Picture" clear
        def butter_lowpass_filter(data, cutoff=0.8, fs=30, order=4):
            nyq = 0.5 * fs
            normal_cutoff = cutoff / nyq
            b, a = butter(order, normal_cutoff, btype='low', analog=False)
            return filtfilt(b, a, data)

        for col in self.joints:
            if col in df.columns:
                signal = df[col].interpolate().ffill().bfill().values.astype(float)
                signal = butter_lowpass_filter(signal, cutoff=0.8, fs=self.fps)
                df[col] = signal
        return df


    def estimate_period_autocorr(self, signal):
        sig_centered = signal - np.mean(signal)
        corr = np.correlate(sig_centered, sig_centered, mode='full')
        corr = corr[len(corr)//2:]

        # Minimum 1.5s, Maximum 10s per rep
        min_lag = int(self.fps * 1.5) 
        max_lag = int(self.fps * 10.0)
        
        search_region = corr[min_lag:max_lag]
        if len(search_region) == 0: return int(self.fps * 4)

        peaks, props = find_peaks(search_region, height=0)
        if len(peaks) > 0:
            best_peak = peaks[np.argmax(props['peak_heights'])]
            return best_peak + min_lag
        return np.argmax(search_region) + min_lag


    def analyze(self, inst_df, stud_df):
        # 1. Find time to complete one repetition for each student and instructor
        inst_periods = []
        stud_periods = []

        for joint in self.joints:
            if joint not in inst_df.columns or joint not in stud_df.columns:
                continue

            inst_periods.append(self.estimate_period_autocorr(inst_df[joint].values))
            stud_periods.append(self.estimate_period_autocorr(stud_df[joint].values))

        if not inst_periods or not stud_periods:
            print("No valid joint data found.")
            return

        # Choose the max period, which is the "Dominant Rhythm"
        inst_period = int(np.max(inst_periods))
        stud_period = int(np.max(stud_periods))

        for joint in self.joints:
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


def align_reps(base_name, ideal_base_name, data_dir="./data"):
    imp_joints_path = os.path.join(data_dir, f"{ideal_base_name}-imp-joints.json")
    baseline_path = os.path.join(data_dir, f"{ideal_base_name}-angles.json")
    input_path    = os.path.join(data_dir, f"{base_name}-angles.json")
    
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
        imp_joints = json.load(file)
    
    counter = DeepCycleCounter(imp_joints)
    
    inst_df = counter.preprocess(counter.load_json_to_df(baseline_path))
    stud_df = counter.preprocess(counter.load_json_to_df(input_path, drop_unusable=True))

    counter.analyze(inst_df, stud_df)
