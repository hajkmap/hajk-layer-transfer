export const STATUS_COLORS = {
  replaced: "#14532d",
  added: "#15803d",
  change: "#1d4ed8",
  new: "#c2410c",
};

export const STATUS_LEGEND = [
  {
    key: "new",
    color: STATUS_COLORS.new,
    label: "Missing in target",
    detail: "Exists in source but not in target. Copy it over.",
  },
  {
    key: "change",
    color: STATUS_COLORS.change,
    label: "Different",
    detail:
      "Found on both sides, but the content does not match. Source is filled blue; target uses a dashed blue outline.",
  },
  {
    key: "added",
    color: STATUS_COLORS.added,
    label: "Copied",
    detail: "Copied into the target in this session.",
  },
  {
    key: "replaced",
    color: STATUS_COLORS.replaced,
    label: "Replaced",
    detail: "Replaced in the target in this session.",
  },
];

export const getStatusColor = (item) => {
  if (!item) {
    return undefined;
  }
  if (item.__is_replaced === true) {
    return STATUS_COLORS.replaced;
  }
  if (item.__is_added === true) {
    return STATUS_COLORS.added;
  }
  if (item.__possible_change === true) {
    return STATUS_COLORS.change;
  }
  if (item.__possible_new === true) {
    return STATUS_COLORS.new;
  }
  return undefined;
};
