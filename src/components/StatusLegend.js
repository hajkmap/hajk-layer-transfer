import React, { useState } from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, IconButton, Popover, Typography } from "@mui/material";
import { STATUS_LEGEND } from "../utils/statusColors";

const Swatch = ({ color }) => (
  <Box
    sx={{
      width: 14,
      height: 14,
      borderRadius: "3px",
      bgcolor: color,
      flexShrink: 0,
      border: "1px solid rgba(255,255,255,0.25)",
    }}
  />
);

const StatusLegend = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: 1, gap: 0.75 }}>
      {STATUS_LEGEND.map((item) => (
        <Box
          key={item.key}
          title={item.label}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.4 }}
        >
          <Swatch color={item.color} />
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", lineHeight: 1, whiteSpace: "nowrap" }}
          >
            {item.label}
          </Typography>
        </Box>
      ))}
      <IconButton
        size="small"
        color="inherit"
        title="Color legend"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{ ml: 0.25 }}
      >
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ p: 1.5, maxWidth: 320 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Color legend
          </Typography>
          {STATUS_LEGEND.map((item) => (
            <Box
              key={item.key}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                mb: 1,
                "&:last-child": { mb: 0 },
              }}
            >
              <Swatch color={item.color} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.detail}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Popover>
    </Box>
  );
};

export default StatusLegend;
