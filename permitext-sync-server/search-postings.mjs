function comparePostingIDs(left, right) {
  if (left === right) return 0;
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export function normalizedSortedPostingList(values) {
  const posting = Array.isArray(values) ? values : Array.from(values || []);
  for (let index = 1; index < posting.length; index += 1) {
    if (comparePostingIDs(posting[index - 1], posting[index]) > 0) {
      posting.sort(comparePostingIDs);
      break;
    }
  }
  return posting;
}

function sortedPostingIncludes(posting, value) {
  let low = 0;
  let high = posting.length - 1;
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const comparison = comparePostingIDs(posting[middle], value);
    if (comparison === 0) return true;
    if (comparison < 0) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return false;
}

export function intersectCandidateIDsWithPosting(candidateIDs, posting) {
  const intersection = new Set();
  if (posting instanceof Set) {
    for (const value of candidateIDs) {
      if (posting.has(value)) intersection.add(value);
    }
    return intersection;
  }
  const sortedPosting = Array.isArray(posting)
    ? posting
    : normalizedSortedPostingList(posting);
  for (const value of candidateIDs) {
    if (sortedPostingIncludes(sortedPosting, value)) intersection.add(value);
  }
  return intersection;
}

export function postingListSize(posting) {
  return Number(posting?.size ?? posting?.length ?? 0);
}
