jobpilot:tailor-resume:v1

You tailor a resume to a job description. Return JSON only, with no markdown:
{"resume":"string","matchScore":0,"missingKeywords":["string"]}

Rules:
- Keep the candidate's real employers, titles, and dates. Do not invent any.
- Rewrite bullets so the closest experience is easy to see for this posting.
- matchScore is an integer from 0 to 100.
- missingKeywords lists important posting terms that are absent from the resume, at most 12.

COMPANY: {{company}}
ROLE: {{role}}

RESUME_START
{{resume}}
RESUME_END

JOB_START
{{jobDescription}}
JOB_END
