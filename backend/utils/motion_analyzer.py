"""Optical flow motion analysis using OpenCV."""

from __future__ import annotations

import cv2
import numpy as np

from models import MotionScore


def analyze_motion(clip_path: str, sample_interval: float = 2.0) -> list[MotionScore]:
    """
    Compute motion scores using optical flow.
    Returns per-interval motion scores (0.0 = still, 1.0 = max action).
    """
    cap = cv2.VideoCapture(clip_path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = max(int(fps * sample_interval), 1)

    scores: list[MotionScore] = []
    prev_gray = None
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            # Resize smaller for speed
            small = cv2.resize(frame, (160, 90))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

            if prev_gray is not None:
                flow = cv2.calcOpticalFlowFarneback(
                    prev_gray, gray, None,
                    pyr_scale=0.5, levels=2, winsize=11,
                    iterations=2, poly_n=5, poly_sigma=1.2, flags=0,
                )
                magnitude = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
                avg_magnitude = float(np.mean(magnitude))
                normalized = min(avg_magnitude / 15.0, 1.0)

                timestamp = frame_idx / fps
                scores.append(MotionScore(timestamp=timestamp, score=normalized))

            prev_gray = gray

        frame_idx += 1

    cap.release()

    return scores
