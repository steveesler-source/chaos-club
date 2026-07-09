from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import json
import os
import random
import string
import threading

ROOT = Path(__file__).parent
DATA_FILE = ROOT / "chaos_data.json"
CHALLENGE_COUNT = 8
LOCK = threading.Lock()


def default_group(code):
    return {
        "groupName": "",
        "members": ["Maya", "Sam", "Jess"],
        "groupCode": code,
        "publicUrl": "",
        "activeStep": "group",
        "challengeIndex": random.randrange(CHALLENGE_COUNT),
        "answers": [],
        "votes": {},
        "recap": "",
    }


def load_data():
    if not DATA_FILE.exists():
        return {"groups": {}}

    try:
        return json.loads(DATA_FILE.read_text())
    except json.JSONDecodeError:
        return {"groups": {}}


def save_data(data):
    DATA_FILE.write_text(json.dumps(data, indent=2, sort_keys=True))


def create_code():
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


def clean_code(value):
    cleaned = "".join(character for character in value.upper() if character.isalnum())
    return cleaned[:12] or create_code()


def get_group(data, raw_code):
    code = clean_code(raw_code or create_code())
    groups = data.setdefault("groups", {})
    if code not in groups:
        groups[code] = default_group(code)
    return groups[code]


def next_challenge(current):
    if CHALLENGE_COUNT <= 1:
        return 0

    choice = random.randrange(CHALLENGE_COUNT)
    while choice == current:
        choice = random.randrange(CHALLENGE_COUNT)
    return choice


def apply_action(group, action, payload):
    if action == "update_group":
        if "groupName" in payload:
            group["groupName"] = str(payload["groupName"])[:32]
        if "publicUrl" in payload:
            group["publicUrl"] = str(payload["publicUrl"]).rstrip("/")[:160]
        if "activeStep" in payload and payload["activeStep"] in {"group", "answers", "votes", "reveal"}:
            group["activeStep"] = payload["activeStep"]

    if action == "add_member":
        name = str(payload.get("name", "")).strip()[:24]
        names = [member.lower() for member in group["members"]]
        if name and name.lower() not in names:
            group["members"].append(name)

    if action == "remove_member":
        name = str(payload.get("name", ""))
        group["members"] = [member for member in group["members"] if member != name]
        group["answers"] = [answer for answer in group["answers"] if answer["member"] != name]
        group["votes"].pop(name, None)
        group["votes"] = {voter: vote for voter, vote in group["votes"].items() if vote != name}

    if action == "start_round":
        group["activeStep"] = "answers"
        group["recap"] = ""

    if action == "submit_answer":
        member = str(payload.get("member", ""))
        text = str(payload.get("text", "")).strip()[:180]
        if member in group["members"] and text:
            group["answers"] = [answer for answer in group["answers"] if answer["member"] != member]
            group["answers"].append({"member": member, "text": text})
            if len(group["answers"]) >= min(2, len(group["members"])):
                group["activeStep"] = "votes"

    if action == "vote":
        voter = str(payload.get("voter", ""))
        answer_member = str(payload.get("answerMember", ""))
        answered_members = [answer["member"] for answer in group["answers"]]
        if voter in group["members"] and answer_member in answered_members and voter != answer_member:
            group["votes"][voter] = answer_member

    if action == "generate_recap":
        recap = str(payload.get("recap", "")).strip()[:600]
        if recap:
            group["recap"] = recap
            group["activeStep"] = "reveal"

    if action == "reset_round":
        group["activeStep"] = "answers"
        group["challengeIndex"] = next_challenge(int(group.get("challengeIndex", 0)))
        group["answers"] = []
        group["votes"] = {}
        group["recap"] = ""


class ChaosHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            query = parse_qs(parsed.query)
            with LOCK:
                data = load_data()
                group = get_group(data, query.get("group", [""])[0])
                save_data(data)
                self.send_json(group)
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/action":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")

        try:
            request = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400)
            return

        with LOCK:
            data = load_data()
            group = get_group(data, request.get("group", ""))
            apply_action(group, request.get("action", ""), request.get("payload", {}))
            save_data(data)
            self.send_json(group)

    def send_json(self, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4301"))
    server = ThreadingHTTPServer(("0.0.0.0", port), ChaosHandler)
    print(f"Chaos Club backend running on port {port}")
    server.serve_forever()
