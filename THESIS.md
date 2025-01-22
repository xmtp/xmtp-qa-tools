# Why organizations should consider E2EE when sharing sensitive data

## Abstract

Artificial intelligence (AI) is driving the transition to **Web4**, a “web of agents” in which specialized AI programs autonomously connect and collaborate in real time. The greatest opportunities for AI solutions increasingly stem not from public web data—already widely available—but from **private, high-value datasets** that hold sensitive or commercially valuable information.

However, sharing this proprietary data securely over open networks requires a robust approach to encryption and identity management. In these emerging **multi-agent systems**, an **Agent Computer Interface (ACI)** allows AI agents to interact with data sources and tools with minimal human supervision. At the same time, **end-to-end encryption (E2EE)** becomes critical for safeguarding these valuable datasets and ensuring compliance with sector-specific regulations in finance, healthcare, government, and beyond. This paper explores how open protocols like **XMTP** address these challenges by offering strong E2EE, metadata minimization, and decentralized trust guarantees—essential features for the growing **AI private data market**.

## Multi-agent systems

![1](/media/1.webp)

Under **Web4**, autonomous agents don’t rely exclusively on publicly indexed content. Instead, they tap into **restricted datasets** licensed by enterprises, governments, and other institutions. This new paradigm unlocks significant value and innovation but demands robust controls for:

1. **Authentication** – Ensuring only authorized AI agents can access the private data.
2. **Encryption** – Guaranteeing end-to-end confidentiality, from data origin to the agent’s environment.
3. **Compliance** – Enabling secure audit trails and cryptographic proofs while shielding message content from unauthorized eyes.

Increasingly, organizations sell or lease access to real-time financial data, anonymized healthcare records, or specialized databases. These shared resources form a multi-agent ecosystem powered by advanced compute and specialized data—making airtight security paramount.

## MCP from Anthropic

![1](/media/2.webp)

MCP is an open protocol that standardizes how applications provide context to LLMs. Think of MCP like a USB-C port for AI applications. Just as USB-C provides a standardized way to connect your devices to various peripherals and accessories, MCP provides a standardized way to connect AI models to different data sources and tools.

### [\*\*](https://modelcontextprotocol.io/introduction#why-mcp)Why MCP?\*\*

MCP helps you build agents and complex workflows on top of LLMs. LLMs frequently need to integrate with data and tools, and MCP provides:

- A growing list of pre-built integrations that your LLM can directly plug into
- The flexibility to switch between LLM providers and vendors
- Best practices for securing your data within your infrastructure

### [\*\*](https://modelcontextprotocol.io/introduction#general-architecture)General architecture\*\*

At its core, MCP follows a client-server architecture where a host application can connect to multiple servers:

- **MCP Hosts**: Programs like Claude Desktop, IDEs, or AI tools that want to access data through MCP
- **MCP Clients**: Protocol clients that maintain 1:1 connections with servers
- **MCP Servers**: Lightweight programs that each expose specific capabilities through the standardized Model Context Protocol
- **Local Data Sources**: Your computer’s files, databases, and services that MCP servers can securely access
- **Remote Services**: External systems available over the internet (e.g., through APIs) that MCP servers can connect to

## LLMs private data

While public web data is abundant and broadly indexed, **high-value, private datasets** represent the next frontier for AI innovation—whether in law, finance, healthcare, or government. AI systems that harness these specialized resources can deliver unprecedented capabilities. For instance:

- **AI-driven legal research** – Quickly processing case law, contracts, or patent filings from private databases.
- **Financial intelligence** – Analyzing large volumes of real-time trading or market data under strict privacy regulations.
- **Healthcare insights** – Mining patient records or medical imaging data (with protected health information) to advance research.

E2EE at the query and response level ensures compliance with data privacy mandates—especially important in heavily regulated sectors where server-side decryption is disallowed.

### Example use case: Legal AI with proprietary datasets

![1](/media/3.webp)

Platforms like **Harvey**—a legal AI system—illustrate how specialized data feeds power next-generation capabilities. Governments, financial institutions, and corporations maintain proprietary records and reference materials, typically stored in vector databases (e.g., Pinecone, Activeloop) and accessed through retrieval-augmented generation (RAG). By sending encrypted queries and receiving encrypted results, legal AI platforms can efficiently answer complex questions without compromising confidentiality.

## Conclusion

As we enter the **web of agents (Web4)** and an **AI private data market** defined by proprietary intelligence, secure messaging and data exchange are crucial for unlocking the true potential of AI. **XMTP** offers a unique blend of benefits:

### **Why TLS Isn’t Enough**

- **Transit-only encryption** – TLS protects data in transit, but servers typically decrypt data on their end. Many legal and financial regulations forbid server-side data exposure.
- **Operational overhead** – Juggling multiple encrypted messaging tools (email, secure APIs, etc.) is cumbersome for enterprise teams and difficult to scale
- **Group collaboration** – The Messaging Layer Security (MLS) standard, which XMTP builds upon, supports secure group messaging among multiple agents and humans

### Why XMTP for interoperable E2EE?

![1](/media/4.webp)

- **True end-to-end encryption (E2EE):** Unlike TLS, which encrypts only in transit and typically decrypts on the server side, XMTP can preserve confidentiality from the originating client all the way to the intended recipients—ideal for sensitive data in finance, healthcare, legal services, and more
- **Metadata protection:** XMTP’s design obscures who sent or received a message, a crucial feature for high-privacy or regulated scenarios.
- **Group and multi-agent support:** Built atop standards like the Messaging Layer Security (MLS), XMTP supports secure group communication among many agents (and humans), which is central to multi-agent workflows.
- **Interoperable ecosystem:** As an open protocol, XMTP plugs into existing AI tools or enterprise environments with minimal friction, providing flexibility for organizations to combine secure E2EE with advanced multi-agent services.

By combining standardized protocols like **MCP** with next-generation messaging layers such as **XMTP**, AI-driven organizations can confidently harness private data while meeting critical security and compliance requirements.
