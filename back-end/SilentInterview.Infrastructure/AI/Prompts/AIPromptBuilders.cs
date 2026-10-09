using System.Text;

namespace SilentInterview.Infrastructure.AI.Prompts;

/// <summary>Shared language-name resolution so every AI prompt refers to the target
/// language explicitly, forcing the model to generate/evaluate/report in it.</summary>
public static class LanguageMap
{
    public static string Name(string? code) => (code ?? "en").ToLowerInvariant() switch
    {
        "az" => "Azerbaijani",
        "ru" => "Russian",
        _ => "English"
    };

    public static string Normalize(string? code)
    {
        var c = (code ?? "en").ToLowerInvariant();
        return c is "az" or "ru" or "en" ? c : "en";
    }
}

public static class QuestionGenerationPromptBuilder
{
    public static string BuildSystem(string languageName) => $"""
        You are a senior HR recruiter, technical interviewer and behavioral interviewer with
        15+ years of experience building structured interview loops for top technology companies.
        You design interview question sets that are precise, role-relevant, and non-generic.
        You always respond with strict JSON only — no markdown, no commentary, no code fences.
        You write all question text in {languageName}.

        ABSOLUTE LANGUAGE LOCK:
        - Every question, introduction, expected answer and evaluation criterion MUST be in {languageName}.
        - Never switch to English or Russian unless {languageName} itself is English or Russian.
        - The candidate's answer language is irrelevant; output language is ALWAYS {languageName}.
        - Do not translate the target language from the candidate's answer.
        """;

    public static string BuildUser(
        string jobTitle,
        string jobDescription,
        IReadOnlyList<string> requiredSkills,
        string? experienceLevel,
        string? companyCulture,
        string? seniorityLevel,
        int durationMinutes,
        string languageName,
        string uniquenessSeed)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Job Title: {jobTitle}");
        sb.AppendLine($"Job Description: {jobDescription}");
        sb.AppendLine($"Required Skills: {(requiredSkills.Count > 0 ? string.Join(", ", requiredSkills) : "not specified")}");
        sb.AppendLine($"Experience Level: {experienceLevel ?? "not specified"}");
        sb.AppendLine($"Seniority Level: {seniorityLevel ?? "not specified"}");
        sb.AppendLine($"Company Culture: {companyCulture ?? "not specified"}");
        sb.AppendLine($"Target Interview Duration: {durationMinutes} minutes");
        sb.AppendLine($"Uniqueness Seed (use to vary phrasing/angles vs any prior generation, do not print this): {uniquenessSeed}");
        sb.AppendLine();
        sb.AppendLine($"Generate a complete AI interview structure in {languageName}.");
        sb.AppendLine("""

            Produce 6 sections in this exact order: "technical", "behavioral", "situational", "soft_skill",
            "culture_fit", "problem_solving".
            Each section must contain 2-4 unique, specific, non-generic questions tailored to the job above.
            Questions must not repeat across sections. Do not reuse generic template phrasing —
            ground every question in the specific job title, skills and seniority given.

            Within each section, order questions by increasing difficulty (difficultyLevel: "easy" then
            "medium" then "hard") so the interview has a clear difficulty progression.

            For every question also provide:
            - expectedAnswer: 1-3 sentences describing what a strong answer would cover (for the
              recruiter's reference — never shown to the candidate).
            - evaluationCriteria: 2-4 short bullet-style strings the recruiter can score the candidate's
              answer against (e.g. "Mentions specific tools/technologies used", "Explains trade-offs
              considered", "Demonstrates ownership of the outcome").

            Also write a short "introduction" (2-4 sentences, in the target language) that the AI
            interviewer would read aloud to welcome the candidate and set expectations before Q&A begins.

            Respond with ONLY this JSON shape:
            {
              "interviewTitle": string,
              "introduction": string,
              "difficulty": "Junior" | "Mid" | "Senior" | "Lead",
              "estimatedDurationMinutes": number,
              "sections": [
                { "type": "technical", "questions": [
                    { "text": string, "difficultyLevel": "easy"|"medium"|"hard",
                      "expectedAnswer": string, "evaluationCriteria": [string, ...] }
                  ] },
                { "type": "behavioral", "questions": [ ... same shape ... ] },
                { "type": "situational", "questions": [ ... same shape ... ] },
                { "type": "soft_skill", "questions": [ ... same shape ... ] },
                { "type": "culture_fit", "questions": [ ... same shape ... ] },
                { "type": "problem_solving", "questions": [ ... same shape ... ] }
              ]
            }
            """);
        return sb.ToString();
    }
}

public static class InterviewFlowPromptBuilder
{
    public static string BuildEvaluationSystem(string languageName) => $"""
        You are an expert technical and behavioral interviewer evaluating a single candidate answer
        in real time during a live interview. Be precise, fair, and evidence-based — do not invent
        details the candidate did not say. Write all natural-language output in {languageName}.
        Respond with strict JSON only — no markdown, no commentary, no code fences.
        """;

    public static string BuildEvaluationUser(
        string jobTitle,
        string sectionType,
        string question,
        string answer,
        IReadOnlyList<string> previousQuestions,
        string languageName)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Job Title: {jobTitle}");
        sb.AppendLine($"Current Section: {sectionType}");
        if (previousQuestions.Count > 0)
        {
            sb.AppendLine("Previously asked questions in this interview:");
            foreach (var q in previousQuestions) sb.AppendLine($"- {q}");
        }
        sb.AppendLine();
        sb.AppendLine($"Question: {question}");
        sb.AppendLine($"Candidate's Answer: {answer}");
        sb.AppendLine();
        sb.AppendLine("""

            Evaluate this answer and decide what the AI interviewer should do next.

            Score each dimension 0-100 based only on evidence in the answer:
            - technicalAccuracy: correctness/soundness of any technical claims
            - communicationScore: clarity, structure, articulation
            - confidenceScore: conveyed confidence in the wording (not appearance)
            - clarityScore: how unambiguous and well-formed the answer is
            - depthScore: thoroughness, specificity, use of concrete detail/examples

            Decide nextAction:
            - "continue_deeper" if the answer reveals specific experience worth probing further
              (e.g. mentions a tool/technique that has an obvious deeper follow-up)
            - "clarify" if the answer is vague, incomplete, or ambiguous and needs clarification
            - "move_next" if the answer is sufficiently complete and it's time for the next planned question
            """);
        sb.AppendLine();
        sb.AppendLine($"""
            If nextAction is "continue_deeper" or "clarify", write ONE natural follow-up question in
            {languageName} in "followUpQuestion" that directly references something specific the
            candidate said. Otherwise leave followUpQuestion null.
            """);
        sb.AppendLine();
        sb.AppendLine("""
            Respond with ONLY this JSON shape:
            {
              "technicalAccuracy": number, "communicationScore": number, "confidenceScore": number,
              "clarityScore": number, "depthScore": number,
              "keywordsDetected": [string, ...],
              "strengths": [string, ...],
              "weaknesses": [string, ...],
              "followUpNeeded": boolean,
              "aiComment": string,
              "nextAction": "continue_deeper" | "clarify" | "move_next",
              "followUpQuestion": string | null
            }
            """);
        return sb.ToString();
    }
}

public static class ReportAIPromptBuilder
{
    public static string BuildSystem(string languageName) => $"""
        You are an evidence-first interview coach writing a professional report in {languageName}.
        Ground every conclusion in the candidate's recorded answers and clearly separate observed
        evidence from interpretation. Do not invent facts, skills, achievements, metrics, or quotes.
        When possible, cite the answer number (for example, [Q2]) in the relevant explanation.
        When evidence is missing or ambiguous, say that it is insufficient rather than guessing.

        Fairness and decision safeguards:
        - This report is coaching and decision support, not an automated hiring decision.
        - Do not infer personality, mental state, honesty, motivation, competence, or job suitability
          from a face, facial expression, detected emotion, eye contact, appearance, accent, pauses,
          speaking speed, or other camera/body-language signal.
        - Do not use emotion, eye-contact, biometric, or camera-derived confidence values to support
          the hiring recommendation, role match, learning potential, or evidence-confidence score.
          If relevant, these signals can only be framed as optional and uncertain presentation-coaching
          feedback, never as hiring evidence.
        - Do not make judgments about culture fit. Use the legacy cultureFit field only for specific,
          job-relevant collaboration evidence stated in answers. If no example exists, say so.
        - Do not estimate salary. Interview responses and self-reported skills are not a salary dataset.
          State that salary is not assessed because salary expectations, location, and a reliable market
          range were not supplied.
        - The only job context may be the title, not a complete job description. Do not claim a full
          role match or list requirements that were not provided. Explicitly note this limitation.
        - Treat listed candidate skills and experience as self-reported context, not independently
          verified facts.
        - Strengths must connect to specific answer evidence. Weaknesses should describe answer gaps
          or skills that remain unverified, not personal traits. Risk factors should be neutral items
          to clarify, not assumptions about the person.
        - If the interview contains too little evidence for a recommendation, choose "Needs Review".
        - confidenceScore is 0-100 for completeness and consistency of the evidence available to write
          this report. It is NOT a chance of hiring success, candidate quality, or probability of passing.

        Write the entire report in {languageName}. Respond with strict JSON only: no markdown,
        no commentary, and no code fences.
        """;

    public static string BuildUser(
        string jobTitle,
        string candidateSkills,
        string candidateExperience,
        string transcriptAndEvaluations,
        string deterministicSignals,
        string languageName)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Job title (only job context supplied): {jobTitle}");
        sb.AppendLine($"Candidate-stated skills (self-reported, not verified): {candidateSkills}");
        sb.AppendLine($"Candidate-stated experience (self-reported, not verified): {candidateExperience}");
        sb.AppendLine();
        sb.AppendLine("=== Recorded Interview Questions, Answers, and Per-Answer AI Evaluations ===");
        sb.AppendLine(transcriptAndEvaluations);
        sb.AppendLine();
        sb.AppendLine("=== Additional Session Metrics (limited reliability; not hiring evidence) ===");
        sb.AppendLine(deterministicSignals);
        sb.AppendLine();
        sb.AppendLine($"Prepare a practical, fair, evidence-led interview feedback report in {languageName}.");
        sb.AppendLine("Use recorded answer content as the primary evidence. The extra session metrics may be incomplete,");
        sb.AppendLine("camera-derived, or indirect. Do not let them influence job-fit judgments, hiringRecommendation,");
        sb.AppendLine("or confidenceScore. Do not infer that a person is nervous, distracted, dishonest, unconfident, or");
        sb.AppendLine("unsuitable based on gaze, facial expression, emotion labels, pauses, accent, or presentation style.");
        sb.AppendLine("Do not treat the legacy deterministic score, pass probability, or hiring recommendation as ground truth.");
        sb.AppendLine("Cite [Q#] evidence in strengths and analyses when possible. State what is unknown and what a human");
        sb.AppendLine("reviewer should validate. Do not create fictitious direct quotes or specific achievements.");
        sb.AppendLine();
        sb.AppendLine("Respond with ONLY this JSON shape:");
        sb.AppendLine("""
            {
              "executiveSummary": string,
              "hiringRecommendation": "Strong Hire" | "Potential Hire" | "Needs Review" | "Reject",
              "hiringRecommendationReason": string,
              "candidateProfile": string,
              "technicalAnalysis": string,
              "communicationAnalysis": string,
              "behaviorAnalysis": string,
              "leadershipAnalysis": string,
              "cultureFit": string,
              "problemSolving": string,
              "strengths": [string, ...],
              "weaknesses": [string, ...],
              "riskFactors": [string, ...],
              "learningPotential": string,
              "salaryEstimation": string,
              "roleMatch": string,
              "nextInterviewRecommendation": string,
              "customFollowUpQuestions": [string, ...],
              "confidenceScore": number
            }
            """);
        sb.AppendLine("Field guidance:");
        sb.AppendLine("- hiringRecommendation/hiringRecommendationReason: treat as a tentative, evidence-limited suggestion");
        sb.AppendLine("  for a human reviewer, never an automatic decision. Prefer Needs Review when evidence is sparse.");
        sb.AppendLine("- candidateProfile: distinguish candidate-stated background from interview-demonstrated evidence.");
        sb.AppendLine("- technicalAnalysis, communicationAnalysis, behaviorAnalysis, problemSolving: focus on answer content,");
        sb.AppendLine("  reasoning, clarity, specificity, and structure; cite [Q#] where possible.");
        sb.AppendLine("- leadershipAnalysis: only describe examples of leadership explicitly evidenced in an answer. Otherwise");
        sb.AppendLine("  state that no clear example was provided; do not infer leadership from camera or delivery signals.");
        sb.AppendLine("- cultureFit: describe specific, role-relevant collaboration examples only; do not judge cultural similarity.");
        sb.AppendLine("- strengths: every item should cite an answer number or identify the concrete answer evidence.");
        sb.AppendLine("- weaknesses: phrase as a gap in the answer or an unverified skill, with a constructive follow-up.");
        sb.AppendLine("- riskFactors: neutral, unresolved questions for a human reviewer; use an empty list if none.");
        sb.AppendLine("- learningPotential: only discuss demonstrated learning/adaptation evidence; otherwise say insufficient evidence.");
        sb.AppendLine("- salaryEstimation: explicitly say it is not assessed because expectations, location, and market data were not supplied.");
        sb.AppendLine("- roleMatch: compare only with the job title and the available self-reported skills/answers; state that a full");
        sb.AppendLine("  match cannot be confirmed without the actual job description and consistent role criteria.");
        sb.AppendLine("- nextInterviewRecommendation: give a practical next step or human validation action, not a final decision.");
        sb.AppendLine("- customFollowUpQuestions: provide targeted questions that test unresolved job-related evidence.");
        sb.AppendLine("- confidenceScore: 0-100 score for the completeness/consistency of available evidence only; do not use passProbability.");
        return sb.ToString();
    }
}

public static class AIAssistantPromptBuilder
{
    public static string BuildSystem(string languageName) => $"""
        You are an AI HR assistant embedded in a recruiter's dashboard. You answer the recruiter's
        questions about their candidates using ONLY the interview data provided to you below —
        never invent candidates, scores or facts not present in that data. If the data provided is
        insufficient to answer, say so plainly. Respond conversationally in {languageName}, in plain
        text (not JSON) — concise, professional, and directly useful to a hiring decision-maker.
        You remember previous messages in this conversation and use them as context.
        """;

    public static string BuildUser(
        string question,
        string groundingData,
        List<(string Role, string Content)>? conversationHistory = null)
    {
        var sb = new StringBuilder();

        sb.AppendLine("=== Candidate / Interview Data Available ===");
        sb.AppendLine(groundingData);
        sb.AppendLine();

        if (conversationHistory is { Count: > 0 })
        {
            sb.AppendLine("=== Previous Conversation (for context) ===");
            foreach (var (role, msg) in conversationHistory)
            {
                var label = role.Equals("user", StringComparison.OrdinalIgnoreCase) ? "Recruiter" : "Assistant";
                // Truncate very long messages to keep token budget in check
                var truncated = msg.Length > 400 ? msg[..400] + "…" : msg;
                sb.AppendLine($"{label}: {truncated}");
            }
            sb.AppendLine();
        }

        sb.AppendLine("=== Recruiter's Current Question ===");
        sb.AppendLine(question);

        return sb.ToString();
    }
}
