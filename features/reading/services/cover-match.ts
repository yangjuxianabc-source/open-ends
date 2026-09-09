export interface CoverCandidate { provider: "google" | "openlibrary"; externalId: string; title: string; authors: string[]; url?: string }

const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[\s·:：,，.。'“”"《》()（）\-_]/g, "");

function titleScore(queryTitle: string, candidateTitle: string): number {
  const wanted = normalize(queryTitle), found = normalize(candidateTitle);
  if (!wanted || !found) return 0;
  if (wanted === found) return 100;
  if (wanted.length >= 4 && (found.includes(wanted) || wanted.includes(found))) return 72;
  return 0;
}

function authorScore(queryAuthor: string | undefined, authors: string[]): number {
  if (!queryAuthor?.trim()) return 0;
  const wanted = normalize(queryAuthor);
  return authors.some(value => {
    const found = normalize(value);
    return found === wanted || found.includes(wanted) || wanted.includes(found);
  }) ? 20 : 0;
}

/**
 * A translated edition may have a localized title but an original-language
 * author. An exact title is therefore sufficient; author agreement is a
 * confidence bonus, not a hard gate. Near-title matches still need author
 * agreement when an author was supplied.
 */
export function coverMatchScore(queryTitle: string, queryAuthor: string | undefined, candidate: CoverCandidate): number {
  const score = titleScore(queryTitle, candidate.title);
  if (!score) return 0;
  const author = authorScore(queryAuthor, candidate.authors);
  if (score < 100 && queryAuthor?.trim() && !author) return 0;
  return score + author;
}

export function isConfidentCoverMatch(queryTitle: string, queryAuthor: string | undefined, candidate: CoverCandidate): boolean {
  return coverMatchScore(queryTitle, queryAuthor, candidate) >= 100;
}

export function bestCoverMatch(queryTitle: string, queryAuthor: string | undefined, candidates: CoverCandidate[]): CoverCandidate | undefined {
  return candidates.reduce<{ candidate?: CoverCandidate; score: number }>((best, candidate) => {
    const score = coverMatchScore(queryTitle, queryAuthor, candidate);
    return score > best.score ? { candidate, score } : best;
  }, { score: 0 }).candidate;
}
