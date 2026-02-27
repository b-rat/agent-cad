class AIAgent:
    """AI agent backed by Claude for CAD-related conversations."""

    def __init__(self) -> None:
        self.conversation_history: list[dict] = []

    async def send_message(self, user_message: str) -> str:
        """Send a message to the AI agent and return its response."""
        raise NotImplementedError
