# StockMate - Project Guidelines & Workflow

## Working Rules
1. **Communication**: Clear, precise, brief, and right to the point.
2. **Explanations**: Plain words, short, and accessible.
3. **Decision Making**:
   - Plain summary of the decision.
   - Alternatives with clear strengths and weaknesses.
   - Clear recommendation.
4. **Autonomous Recording**: Maintain `docs/` and `docs/adr/` proactively.
5. **Critical Thinking**: Challenge assumptions constructively; never blindly agree.

---

## 10-Stage Workflow

| Phase | # | Stage | Question Answered | Main Output | Status |
| :--- | :-: | :--- | :--- | :--- | :--- |
| **THINK** | 1 | Capture the idea | Which idea is worth my time? | One chosen idea, in one sentence | **Done** |
| | 2 | Frame the problem | Who has what problem, and how do they cope today? | One-page problem brief | **Done** |
| | 3 | Validate before building | Is the problem real enough to build for? | Go, change, or stop decision | **Done** |
| | 4 | Define scope | What is the smallest thing that solves it? | One-page spec with non-goals | **Done** |
| **DESIGN** | 5 | Technical discovery | What could stop us? Which tools do we use? | Drivers sheet, spike results, first ADRs | **Done** |
| | 6 | Design | How will it work? | Design pack (drivers, shape, boundaries, data, interfaces, failure table) | **Done** |
| **BUILD** | 7 | Foundation | Can we ship something tiny, today? | Repo, CI, rules file, live walking skeleton | **In Progress** |
| | 8 | Plan the work | In what order do we build? | Ordered vertical slices | Pending |
| | 9 | The feature build loop | How do we build one slice safely? | Merged, deployed, verified slice | Pending |
| | 10 | Quality gates | How do we know it is good enough? | Tests, security checks, Definition of Done | Pending |
