export function buildWritingCardDirectorContext(input = {}) {
  void input;

  return {
    version: "v2.0.0-minimal",
    context_kind: "writing_card_director_context",
    source: "writing_card_director_service",
    basis: {
      writing_card_version: "v4.1-minimal",
    },
  };
}

export default buildWritingCardDirectorContext;