# Student Side Added

This is the existing HyFlex React project with the Student portal added into the same project.

Student flow:
- Student login using the existing session authentication
- Student dashboard/profile
- Current enrollment / academic year / semester details
- My Courses with search
- Course -> Videos
- YouTube video player
- Resume from max watched position
- Forward-seek blocking when configured
- Video skip ranges
- Playback speed
- Question pause at configured timestamps
- MCQ answer submission and explanation
- Rewatch 15 seconds
- Video progress and question attempt persistence
- Completion status

Admin functionality was kept in the same project and was not removed.

Backend student endpoints are under `/api/student`.
