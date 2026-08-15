import json
import xml.etree.ElementTree as ET
import math
import re

def parse_transform_rotation(transform_str):
    """Extracts angle (in degrees) and pivot point (cx, cy) if transform="rotate(...)" exists."""
    if not transform_str:
        return 0.0, 0.0, 0.0
    
    # Matches rotate(angle) or rotate(angle, cx, cy)
    match = re.search(r'rotate\(\s*([-\d.]+)(?:\s+([-\d.]+)\s+([-\d.]+))?\s*\)', transform_str)
    if match:
        angle_deg = float(match.group(1))
        cx = float(match.group(2)) if match.group(2) is not None else 0.0
        cy = float(match.group(3)) if match.group(3) is not None else 0.0
        return angle_deg, cx, cy
    
    return 0.0, 0.0, 0.0

def convert_rect_svg_to_json(input_svg_path, output_json_path):
    """Extracts <rect> elements into {x, y, width, height, angle} centered format."""
    tree = ET.parse(input_svg_path)
    root = tree.getroot()

    namespaces = {'svg': 'http://www.w3.org/2000/svg'}
    rects = root.findall('.//svg:rect', namespaces) or root.findall('.//rect')

    rect_data = []

    for rect in rects:
        rx = float(rect.attrib.get('x', 0))
        ry = float(rect.attrib.get('y', 0))
        width = float(rect.attrib.get('width', 0))
        height = float(rect.attrib.get('height', 0))
        transform = rect.attrib.get('transform', '')

        # Unrotated center relative to the top-left (rx, ry)
        unrotated_center_x = rx + width / 2.0
        unrotated_center_y = ry + height / 2.0

        angle_deg, px, py = parse_transform_rotation(transform)

        if angle_deg != 0:
            rad = math.radians(angle_deg)
            cos_a = math.cos(rad)
            sin_a = math.sin(rad)

            # Rotate the center point around the transform pivot point (px, py)
            dx = unrotated_center_x - px
            dy = unrotated_center_y - py

            center_x = px + (dx * cos_a - dy * sin_a)
            center_y = py + (dx * sin_a + dy * cos_a)
        else:
            center_x = unrotated_center_x
            center_y = unrotated_center_y

        rect_data.append({
            "x": round(center_x, 4),
            "y": round(center_y, 4),
            "width": width,
            "height": height,
            "angle": round(angle_deg, 4)  # in degrees (convert to radians in JS if needed)
        })

    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(rect_data, f, indent=2)

    print(f"Done! Exported {len(rect_data)} centered rects to '{output_json_path}'.")

if __name__ == '__main__':
    convert_rect_svg_to_json('rectangles.svg', 'rectangles.json')