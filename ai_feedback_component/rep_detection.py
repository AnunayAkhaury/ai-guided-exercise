import json
import pandas as pd
import matplotlib.pyplot as plt
from scipy.signal import find_peaks

# 1. Load the JSON data
file_path = './data/student-pushups-angles.json'
with open(file_path, 'r') as f:
    data = json.load(f)

# 2. Extract frame data into a list of dictionaries
frames = data['frames']
df_list = []
for frame in frames:
    row = {'frameIndex': frame['frameIndex']}
    row.update(frame['angles'])
    df_list.append(row)

# Create a DataFrame for easy manipulation
df = pd.DataFrame(df_list)

# 3. Prepare the signal
# We invert the angles (multiply by -1) because pushups are 'valleys' in the data.
# Peak detection algorithms work better on positive spikes.
left_elbow = -df['left_elbow'].values
right_elbow = -df['right_elbow'].values

# 4. Perform Peak Detection
# prominence=20: The 'dip' must be at least 20 degrees deep to count.
# distance=8: Reps must be at least 8 frames apart (approx 0.8 seconds at 10fps).
peaks_l, _ = find_peaks(left_elbow, prominence=20, distance=8)
peaks_r, _ = find_peaks(right_elbow, prominence=20, distance=8)

# 5. Consolidate Results
# Since arms can move asymmetrically, we combine the frame indices of both arms
all_peak_indices = sorted(list(set(peaks_l) | set(peaks_r)))

# Merge peaks that are very close (within 5 frames) to treat them as one rep
final_reps = []
if all_peak_indices:
    final_reps.append(all_peak_indices[0])
    for p in all_peak_indices[1:]:
        if p - final_reps[-1] > 5:
            final_reps.append(p)

print(f"Detected {len(final_reps)} repetitions.")

# 6. Visualization
plt.figure(figsize=(12, 6))
plt.plot(df['frameIndex'], df['left_elbow'], label='Left Elbow', color='blue', alpha=0.5)
plt.plot(df['frameIndex'], df['right_elbow'], label='Right Elbow', color='red', alpha=0.5)

# Mark the detected reps with vertical dashed lines
for rep_idx in final_reps:
    plt.axvline(x=df.iloc[rep_idx]['frameIndex'], color='green', linestyle='--', alpha=0.7)
    # Highlight the specific points
    plt.scatter(df.iloc[rep_idx]['frameIndex'], df.iloc[rep_idx]['left_elbow'], color='blue')
    plt.scatter(df.iloc[rep_idx]['frameIndex'], df.iloc[rep_idx]['right_elbow'], color='red')

plt.title(f'Pushup Count Analysis: {len(final_reps)} Reps Detected')
plt.xlabel('Frame Index')
plt.ylabel('Angle (degrees)')
plt.legend()
plt.grid(True)
plt.show()

# 7. Output the details for each rep
for i, idx in enumerate(final_reps):
    frame = df.iloc[idx]
    print(f"Rep {i+1}: Frame {frame['frameIndex']} - Left: {frame['left_elbow']:.1f}°, Right: {frame['right_elbow']:.1f}°")