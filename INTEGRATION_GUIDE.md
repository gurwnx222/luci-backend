# Chat System & Booking Notification Integration Guide

This document outlines the implementation of the chat system and booking notification integration between the mobile app (customer) and web app (salon owner).

## Overview

The system enables:
1. Customers to send booking requests from the mobile app
2. Salon owners to receive real-time notifications on the web app
3. Salon owners to accept/reject booking requests
4. Automatic chat room creation when a booking is accepted
5. Real-time messaging between customers and salon owners

## Architecture

### Backend (luci-backend)

#### SocketIO Server
- **File**: `utils/socketServer.js`
- **Purpose**: Manages SocketIO connections and emits booking/chat events
- **Events Emitted**:
  - `booking_notification` - New booking request
  - `booking_status_update` - Booking status changed
  - `chat_room_created` - Chat room created after acceptance

#### Booking Controller Updates
- **File**: `controllers/booking.controller.js`
- **Changes**:
  - Creates chat room automatically when booking is accepted
  - Emits SocketIO events for real-time notifications
  - Integrates with chat backend API

#### Chat API Client
- **File**: `utils/chatApiClient.js`
- **Purpose**: Communicates with chat backend to create users and conversations

#### API Endpoints

**New Endpoints** (matching requirements):
- `POST /api/v1/bookings/request` - Submit booking request
- `GET /api/v1/bookings/:id` - Get booking details
- `PUT /api/v1/bookings/:id/accept` - Accept booking
- `PUT /api/v1/bookings/:id/reject` - Reject booking
- `GET /api/v1/bookings/list?salonOwnerId=...` - Get all bookings for salon

**Legacy Endpoints** (backward compatibility):
- `POST /api/v1/bookings/create-booking` - Submit booking request
- `POST /api/v1/bookings/patch-booking/:bookingId` - Update booking status
- `GET /api/v1/bookings/fetch-salon-bookings` - Get all bookings

### Mobile App (thaimassageapp)

#### Booking Socket Handler
- **File**: `src/utils/bookingSocket.js`
- **Purpose**: Handles booking-related SocketIO events
- **Features**:
  - Listens for booking status updates
  - Auto-navigates to chat when booking is accepted
  - Handles chat room creation notifications

#### Integration in Homescreen
- **File**: `src/Home/Homescreen.js`
- **Changes**:
  - Added booking socket listeners
  - Shows alerts when booking is accepted/rejected
  - Auto-opens chat when booking is accepted

### Web App (luci-web-app)

#### Booking Component
- **File**: `app/components/Booking.jsx`
- **Features**:
  - Fetches real bookings from API
  - Displays booking requests with customer details
  - Accept/Reject buttons with confirmation
  - Real-time updates via SocketIO
  - Browser notifications for new bookings

## Setup Instructions

### Backend Setup

1. **Install Dependencies**:
   ```bash
   cd luci-backend
   npm install socket.io http
   ```

2. **Environment Variables**:
   Add to `.env`:
   ```
   CHAT_BACKEND_URL=http://localhost:5001
   PORT=3000
   ```

3. **Start Server**:
   ```bash
   npm start
   ```

### Mobile App Setup

1. **Socket Configuration**:
   - Update `src/config/chatConfig.js` with your backend URL
   - Ensure SocketIO client is properly configured

2. **Booking Integration**:
   - Booking socket listeners are automatically set up in Homescreen
   - Chat navigation happens automatically when booking is accepted

### Web App Setup

1. **Environment Variables**:
   Add to `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
   ```

2. **Salon Owner ID**:
   - Set `salonOwnerId` in localStorage or fetch from your auth system
   - Update the `fetchSalonOwnerId` function in `Booking.jsx` to match your system

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

## Flow Diagram

```
1. Customer (Mobile) → Sends booking request
   ↓
2. Backend → Creates booking, emits SocketIO event
   ↓
3. Salon Owner (Web) → Receives notification
   ↓
4. Salon Owner → Accepts/Rejects booking
   ↓
5. Backend → Updates booking, creates chat room (if accepted)
   ↓
6. Backend → Emits SocketIO events to both parties
   ↓
7. Customer (Mobile) → Receives notification, chat auto-opens
   ↓
8. Both Parties → Can now chat in real-time
```

## SocketIO Events

### Client → Server
- `user_connected` - User connects to socket
- `send_message` - Send chat message

### Server → Client
- `booking_notification` - New booking request received
- `booking_status_update` - Booking status changed
- `chat_room_created` - Chat room created
- `receive_message` - New chat message received
- `user_status` - User online/offline status

## Testing Checklist

### Booking Flow
- [ ] Send booking request from mobile app
- [ ] Verify notification appears on web app
- [ ] Accept request from web app
- [ ] Verify acceptance notification on mobile app
- [ ] Confirm chat room is created
- [ ] Test reject flow and verify no chat room is created

### Chat Functionality
- [ ] Send message from mobile app
- [ ] Verify message appears on web app
- [ ] Send message from web app
- [ ] Verify message appears on mobile app
- [ ] Test real-time message delivery
- [ ] Test notification delivery for both platforms

### Edge Cases
- [ ] Multiple simultaneous booking requests
- [ ] Offline message queuing and delivery
- [ ] Chat room persistence across app restarts
- [ ] Handling network disconnection/reconnection
- [ ] Message delivery confirmation

## Troubleshooting

### SocketIO Not Connecting
- Check that SocketIO server is running on backend
- Verify CORS settings in `socketServer.js`
- Check network connectivity between client and server

### Chat Room Not Created
- Verify chat backend is running
- Check `CHAT_BACKEND_URL` environment variable
- Review chat API client logs

### Notifications Not Appearing
- Check browser notification permissions (web app)
- Verify SocketIO connection is established
- Check that user IDs match between systems

## Notes

- The chat backend runs separately on port 5000 (default)
- Ensure both main backend (port 3000) and chat backend (port 5000) are running
- Firebase UID is used as the primary identifier for mobile app users
- MongoDB ObjectId is used for salon owners in the web app

