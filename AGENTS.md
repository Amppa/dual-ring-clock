# AGENTS.md — AI Behavioral Contract

## 1. Communication & Language
- **Dialogue**: Match developer's language (Chinese or English). Direct, concise, technical tone. No conversational filler or flattery.
- **Alignment First**: Whenever encountering problems, edge cases, or ambiguous requirements, always align and confirm with the developer before executing. Never guess silently.
- **Code & Commits**: English only for code comments and commit messages (imperative mood).
- **README.md**: Proactively confirm with the developer whether end-user documentation should be in English, Chinese, or bilingual.

## 2. Git Workflow
- Avoid modifying code directly on `main`.
- Use task branches: `feat/<name>`, `fix/<name>`, `refactor/<name>`.
- Auto-commit after each verified logical unit of work (recovery checkpoints).
- **Human-Controlled Merge**: NEVER merge into `main` proactively. Merging strategy (`--ff-only`, `--no-ff`, `--squash`) and timing are strictly directed by the developer.

## 3. Surgical Discipline
- Minimum viable code: implement the smallest reasonable change that satisfies the requirement.
- Touch only lines and files required for the task. Zero unrelated refactoring or reformatting.
- Clean up obsolete code created by your changes in the same pass.

## 4. Verification Policy
- **No Automatic Verification**: Do NOT run automatic/headless/browser verifications (e.g., Puppeteer, test scripts) unless explicitly requested by the developer. Verification is strictly human-controlled.

## 5. Documentation Map
- Project coding standards & MV3 checklists: [DEVELOPMENT.md](DEVELOPMENT.md)
- System architecture & data flows: [ARCHITECTURE.md](ARCHITECTURE.md) *(Optional / As needed)*

