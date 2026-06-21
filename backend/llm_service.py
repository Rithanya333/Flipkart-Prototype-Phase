"""LLM service for AI enforcement narratives via Claude Sonnet 4.5 (Emergent Universal Key)."""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def generate_enforcement_narrative(
    hotspot_summary: dict,
    recommendation: str,
    score: float,
) -> str:
    """Generate a concise enforcement narrative using Claude Sonnet 4.5.

    Falls back to a deterministic rule-based summary if the LLM is unavailable.
    """
    fallback = _fallback_narrative(hotspot_summary, recommendation, score)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        key = os.environ.get("EMERGENT_LLM_KEY")
        if not key:
            return fallback

        system = (
            "You are an AI urban mobility analyst writing for traffic-police control rooms. "
            "Write a 2-3 sentence action brief explaining WHY this hotspot needs the recommended "
            "enforcement and what congestion reduction to expect. Use clear, neutral, operational language. "
            "Avoid marketing tone. No emojis. No headings."
        )
        prompt = (
            f"Hotspot: lat={hotspot_summary.get('lat'):.5f}, lng={hotspot_summary.get('lng'):.5f}\n"
            f"Police Station: {hotspot_summary.get('police_station', 'N/A')}\n"
            f"Junction: {hotspot_summary.get('junction', 'N/A')}\n"
            f"Violations (90 days): {hotspot_summary.get('violations')}\n"
            f"Peak hours: {hotspot_summary.get('peak_hours')}\n"
            f"Top vehicle types: {hotspot_summary.get('top_vehicles')}\n"
            f"Congestion Impact Score: {score:.1f}/100\n"
            f"Suggested Action: {recommendation}\n"
            f"Estimated capacity loss: {hotspot_summary.get('capacity_loss_pct', 0):.1f}%\n\n"
            "Write the brief now."
        )
        chat = LlmChat(
            api_key=key,
            session_id=f"parkpulse-{hotspot_summary.get('id','x')}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=prompt))
        text = (resp or "").strip()
        return text or fallback
    except Exception as exc:  # pragma: no cover
        logger.warning("LLM narrative failed, using fallback: %s", exc)
        return fallback


def _fallback_narrative(s: dict, rec: str, score: float) -> str:
    peak = ", ".join(str(h) + ":00" for h in (s.get("peak_hours") or [])[:2]) or "varied hours"
    veh = ", ".join((s.get("top_vehicles") or [])[:2]) or "mixed traffic"
    cap = s.get("capacity_loss_pct", 0)
    return (
        f"This zone records {s.get('violations', 0)} parking violations dominated by {veh}, "
        f"with peak offences at {peak}. With an impact score of {score:.0f}/100 and an estimated "
        f"{cap:.0f}% lane-capacity loss, {rec.lower()} is the most cost-effective response and is "
        f"expected to reduce intersection delay within the immediate corridor."
    )
