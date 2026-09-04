// A conservative language guard, not an inference engine. Qualified wording must
// remain available to the model without becoming a stronger categorical fact.
export function researchFactQualification(value) {
  const text = String(value || "");
  const hypothetical = /\b(?:what if|suppos(?:e|ing)|assum(?:e|ing|ptions?)|hypothetic(?:al|ally)|if|unless|would|could)\b/i.test(text);
  const qualified = /\b(?:not|no|never|neither|without|only|part|partly|partial(?:ly)?|some|selected|certain|except|excluding|limited to|at least|at most|more than|less than|fewer than|approximately|about|unknown|uncertain|unsure|unconfirmed|undetermined|not yet known|to be determined|tbd|may|might|possibly|probably|reportedly)\b|\b\w+n['’]t\b|\bnon[- ](?:existing|sprinklered)\b/i.test(text);
  return { hypothetical, qualified };
}
