from unittest.mock import patch, AsyncMock, MagicMock
import asyncio


@patch("services.agno_agent.MCPTools")
def test_build_agent_uses_deepseek_chat_by_default(MockMCPTools):
    from agno.models.deepseek import DeepSeek
    from services.agno_agent import build_agent

    mock_tools = MagicMock()
    mock_tools.connect = AsyncMock()
    MockMCPTools.return_value = mock_tools

    async def run():
        agent, tools = await build_agent(reasoning=False)
        assert isinstance(agent.model, DeepSeek)
        assert agent.model.id == "deepseek-chat"

    asyncio.run(run())


@patch("services.agno_agent.MCPTools")
def test_build_agent_uses_reasoner_when_reasoning_true(MockMCPTools):
    from agno.models.deepseek import DeepSeek
    from services.agno_agent import build_agent

    mock_tools = MagicMock()
    mock_tools.connect = AsyncMock()
    MockMCPTools.return_value = mock_tools

    async def run():
        agent, tools = await build_agent(reasoning=True)
        assert agent.model.id == "deepseek-reasoner"

    asyncio.run(run())
