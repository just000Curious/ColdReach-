# job_scorer.py
# Extracted from original ai_engine.py to perform fast, keyword-based scoring without LLM latency.

# ── Seniority filter keywords ──────────────────────────────────────
SKIP_KEYWORDS = ["senior", "lead", "principal", "staff", "director", "manager"]
SKIP_EXPERIENCE = ["5+ years", "7+ years", "8+ years", "10+ years", "5 years", "7 years"]
BOOST_KEYWORDS = ["intern", "fresher", "junior", "entry level", "entry-level", "graduate"]
BOOST_AMOUNT = 10  # +10 points added to match score

def boost_score(job, score):
    title_lower = job.get("title", "").lower()
    desc_lower = job.get("description", "").lower()
    combined = title_lower + " " + desc_lower
    
    for keyword in BOOST_KEYWORDS:
        if keyword in combined:
            return min(score + BOOST_AMOUNT, 100)
    return score

def score_job(resume_text, job):
    """
    Analyzes job match using keyword matching instead of an LLM.
    Returns: match_score, missing_skills, recommendation
    """
    resume_lower = resume_text.lower()
    required_skills = job.get("skills_required", [])
    
    if not required_skills:
        return {
            "match_score": 50,
            "missing_skills": ["No skills listed in job"],
            "recommendation": "Skip"
        }
    
    matched_skills = []
    missing_skills = []
    
    for skill in required_skills:
        if skill.lower() in resume_lower:
            matched_skills.append(skill)
        else:
            missing_skills.append(skill)
            
    # Calculate base match score
    match_score = int((len(matched_skills) / len(required_skills)) * 100)
    
    # Apply boost for intern/fresher/junior jobs
    match_score = boost_score(job, match_score)
    
    recommendation = "Apply" if match_score >= 60 else "Skip"
    
    return {
        "match_score": match_score,
        "missing_skills": missing_skills,
        "recommendation": recommendation
    }
