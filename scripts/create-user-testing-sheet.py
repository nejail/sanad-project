"""Generate the one-page SANAD Sprint 4 participant note sheet."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor


def create_sheet():
    output = Path(__file__).resolve().parents[1] / "docs" / "user-testing-sprint4-note-sheet.pdf"
    output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output), pagesize=A4)
    c.setTitle("SANAD Sprint 4 participant note sheet")
    c.setAuthor("Mohammed Al-Marri")
    width, height = A4
    left, right = 36, width - 36

    def text(x, y, value, size=9, bold=False):
        c.setFillColor(HexColor("#172B3A"))
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(x, y, value)

    def line(y):
        c.setStrokeColor(HexColor("#C4CED5"))
        c.setLineWidth(.5)
        c.line(left, y, right, y)

    text(left, 802, "SANAD / SPRINT 4", 18, True)
    text(left, 784, "Participant note sheet  |  One anonymous participant per page", 9)
    text(left, 763, "ID: P____    Date/time: __________________    Drives in Qatar? Y / N    Sprint 3? Y / N")
    text(left, 746, "Phone / OS: _______________________    Build / commit: __________________________")
    text(left, 729, "Mode: [ ] Development build / real SMS   [ ] Expo Go / prototype code")
    text(left, 712, "Language / network: __________________    Facilitator / note taker: _________________")
    text(left, 692, 'Consent: "Notes are anonymous and used only for a course project"', 9, True)
    text(left, 677, "Agreement recorded? Y / N    Participation is voluntary; you may stop at any time.", 8.5)
    text(left, 660, "Use no names, numbers, OTPs or plates. Approved test bookings/contact destinations only.", 8)
    line(650)
    text(left, 636, "TASKS", 10, True)
    text(left + 46, 636, "A alone / H helped / F failed / NT not tested; circle one. Time in seconds.", 8)
    text(left, 621, "Start after prompt; stop at completion/give-up. Record help and build blockers separately.", 8)
    tasks = [
        "1. Register with own number + SMS; add car",
        "2. Book battery jump start now",
        "3. Track + contact; explain acceptance",
        "4. Tow + choose garage; explain price",
        "5. Use free car wash",
        "6. Sign out + sign back in; check car",
    ]
    y = 601
    for task in tasks:
        text(left, y, task, 9, True)
        text(left + 310, y, "A / H / F / NT   Time: ______", 8.5)
        text(left, y - 16, "Hesitation / help / exact words: __________________________________________________", 8)
        line(y - 24)
        y -= 44
    text(left, 330, "TARGETED OBSERVATIONS (first unprompted response)", 9, True)
    text(left, 314, "SMS arrival: ____ sec / not tested; resends: ____    T6 SMS / prototype: ____________", 8.5)
    text(left, 298, "Contact: Call found alone? Y/N   WhatsApp? Y/N   First control: ____ sec / not timed", 8.5)
    text(left, 282, "Acceptance noticed? Y/N/not shown   Signal / words: ______________________________", 8.5)
    text(left, 266, "Towing: estimate / final / unsure   Inclusions / exact words: _________________________", 8.5)
    line(257)
    text(left, 243, "AFTER TASKS (record answers; quote exact words)", 9, True)
    questions = [
        "1. Ease requesting help (1 very difficult - 5 very easy):  1 / 2 / 3 / 4 / 5",
        "2. What confused you? ______________________________________________________",
        "3. Trust price and arrival time? Why? ___________________________________________",
        "4. Use instead of garage / insurer? Why? ________________________________________",
        "5. Missing in a real breakdown? _______________________________________________",
        "6. Did the SMS code arrive quickly? _____________________ / real SMS not tested",
        "7. Was it clear what towing price includes? ______________________________________",
    ]
    y = 226
    for question in questions:
        text(left, y, question, 8.5)
        y -= 18
    text(left, 91, "Extra exact quote (task/question #): ______________________________________________", 8.5)
    text(left, 73, "Build blockers / deviations / NT reasons: ___________________________________________", 8.5)
    line(59)
    text(left, 44, "Keep raw notes private. Share one filled sheet only after hiding identifying details.", 8)
    text(right - 17, 29, "1 / 1", 7)
    c.showPage()
    c.save()
    print(output)


if __name__ == "__main__":
    create_sheet()
