"""Pacer, stage 2 on fal.ai: re-render the blockout with Seedance 2.5 reference-to-video.

Reads FAL_KEY from the environment and the prompt from seedance-prompt.md, submits
one 15 s, 16:9, silent 1080p job with the blockout as @Video1, waits for it and
saves the result.

    FAL_KEY=... python3 anime/pacer/fal_seedance.py <blockout-url> [out.mp4]

fal takes the blockout by URL, so upload pacer-blockout.mp4 somewhere public first.
"""

import json
import os
import pathlib
import sys
import time
import urllib.request

ENDPOINT = "bytedance/seedance-2.5/reference-to-video"
HERE = pathlib.Path(__file__).parent


def prompt():
    text = (HERE / "seedance-prompt.md").read_text()
    body = text.split("```text\n", 1)[1].split("```", 1)[0].strip()
    return body.replace("@Video 1", "@Video1")  # fal numbers references without a space


def call(url, data=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None,
                                 headers={"Authorization": "Key " + os.environ["FAL_KEY"],
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    if len(sys.argv) not in (2, 3) or "FAL_KEY" not in os.environ:
        sys.exit("usage: FAL_KEY=... fal_seedance.py <blockout-url> [out.mp4]")
    out = pathlib.Path(sys.argv[2] if len(sys.argv) == 3 else HERE / "pacer-seedance.mp4")
    job = call(f"https://queue.fal.run/{ENDPOINT}", {
        "prompt": prompt(), "video_urls": [sys.argv[1]], "task": "reference",
        "resolution": "1080p", "duration": 15, "aspect_ratio": "16:9", "generate_audio": False,
    })
    print("request", job["request_id"], flush=True)
    while (status := call(job["status_url"]))["status"] != "COMPLETED":
        print(status["status"], status.get("queue_position", ""), flush=True)
        time.sleep(10)
    result = call(job["response_url"])
    urllib.request.urlretrieve(result["video"]["url"], out)
    print("saved", out, "seed", result.get("seed"))


if __name__ == "__main__":
    main()
