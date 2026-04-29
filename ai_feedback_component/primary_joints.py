import json
import sys
import os

PRIMARY_JOINTS = [
    "left_knee",
    "right_knee",
    "left_hip",
    "right_hip",
]

def generate_primary_joints(ideal_base_name, data_dir="./data"):
    output_path = os.path.join(data_dir, f"{ideal_base_name}-imp-joints.json")
    with open(output_path, "w") as f:
        json.dump({"primary_joints": PRIMARY_JOINTS}, f, indent=2)
    print(f"Written: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python primary_joints.py <ideal_base_name>")
        sys.exit(1)
    generate_primary_joints(sys.argv[1])
