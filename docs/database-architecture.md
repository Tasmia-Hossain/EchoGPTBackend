# EchoGPT Backend — Database Architecture

## 1. Overview

EchoGPT Backend uses PostgreSQL with Prisma ORM.

The database is designed around users, authentication sessions,
subscriptions, AI providers, chat conversations, web searches,
search caching, and API usage tracking.

---

## 2. Core Models

The database will contain the following main models:

1. User
2. Role
3. Session
4. Subscription
5. AIProvider
6. ChatConversation
7. ChatMessage
8. WebSearch
9. SearchCache
10. APIUsageLog

---

## 3. User

Stores registered user information.

Responsibilities:

- User registration
- Login
- Profile management
- Email verification
- Ownership of user resources

The User model was initially created during Phase 6.

---

## 4. Role

Defines user permissions.

Initial roles:

- USER
- ADMIN

ADMIN users can access administrative APIs.

---

## 5. Session

Stores active authentication sessions.

Used for:

- Refresh tokens
- Session expiration
- Token revocation
- Logout

One user can have multiple sessions.

Relationship:

User 1 ──── * Session

---

## 6. Subscription

Stores the user's subscription plan.

Plans:

- FREE
- PREMIUM

Usage limits will be based on the subscription plan.

Relationship:

User 1 ──── 1 Subscription

---

## 7. AIProvider

Stores configured AI providers.

Supported providers:

- OpenAI
- Claude
- Gemini

Provider configuration includes information such as:

- Provider name
- Model
- Enabled status
- Default status

API keys must not be stored as plain text.

---

## 8. ChatConversation

Represents a user's chat conversation.

One user can create multiple conversations.

Relationship:

User 1 ──── * ChatConversation

---

## 9. ChatMessage

Stores messages inside a conversation.

A conversation can contain multiple messages.

Messages can represent:

- User messages
- AI responses

Relationship:

ChatConversation 1 ──── * ChatMessage

---

## 10. WebSearch

Stores web search history.

Each search belongs to a user.

Example information:

- Search query
- Search results
- Created time

Relationship:

User 1 ──── * WebSearch

---

## 11. SearchCache

Stores cached search results.

Purpose:

- Reduce repeated external search requests
- Improve response speed
- Reduce unnecessary API usage

SearchCache is not directly owned by a user.

---

## 12. APIUsageLog

Tracks API usage.

Used for:

- Monthly usage limits
- Usage analytics
- Admin monitoring
- Request tracking

Relationships:

User 1 ──── * APIUsageLog

AIProvider 1 ──── * APIUsageLog

---

# 13. Main Relationships

User
│
├── Session
│
├── Subscription
│
├── ChatConversation
│       └── ChatMessage
│
├── WebSearch
│
├── APIUsageLog
│
└── Role

AIProvider
└── APIUsageLog

SearchCache
└── Cached search results

---

# 14. Subscription Usage Limits

FREE:

- 100 requests per month

PREMIUM:

- 5000 requests per month

These values should be configurable rather than hard-coded throughout the application.

---

# 15. Security Considerations

The database architecture must support:

- Password hashing
- JWT authentication
- Refresh token rotation
- Refresh token revocation
- User ownership checks
- Role-based access control
- Protected API keys
- Usage limiting

Users must only be able to access resources that belong to them.

---

# 16. Architecture Summary

User
→ Authentication
→ Subscription
→ Chat
→ Search
→ Usage Tracking

Admin
→ User Management
→ Subscription Management
→ AI Provider Management
→ Usage Analytics
→ Request Logs
→ System Health

AI Providers
→ OpenAI
→ Claude
→ Gemini