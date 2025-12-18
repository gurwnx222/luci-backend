# Postman Testing Guide for Recommendation System

## Prerequisites
- Server running on `http://localhost:3000` (or your configured PORT)
- MongoDB connected

## Step-by-Step Testing

### Step 1: Create a Salon Owner

**Endpoint:** `POST http://localhost:3000/api/v1/register/register-salon-owner`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "salonOwnerName": "John Doe",
  "salonOwnerEmail": "john.doe@example.com"
}
```

**Expected Response:**
```json
{
  "_id": "...",
  "salonOwnerName": "John Doe",
  "salonOwnerEmail": "john.doe@example.com",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Save the `_id` from response - this is your `salonOwnerId`**

---

### Step 2: Create a Salon Profile

**Endpoint:** `POST http://localhost:3000/api/v1/register/register-salon-profile`

**Headers:**
```
Content-Type: multipart/form-data
```

**Body (form-data):**
- `ownerEmail`: `john.doe@example.com` (must match Step 1)
- `ownerName`: `John Doe` (must match Step 1)
- `salonName`: `Elite Relax Studio`
- `location`: `{"streetAddress":"Shahrah-e-Faisal","city":"Karachi","province":"Sindh","country":"Pakistan"}` (as JSON string)
  - **Working addresses for geocoding:**
    - `{"streetAddress":"Shahrah-e-Faisal","city":"Karachi","province":"Sindh","country":"Pakistan"}`
    - `{"streetAddress":"DHA Phase 5","city":"Karachi","province":"Sindh","country":"Pakistan"}`
    - `{"streetAddress":"Clifton Block 2","city":"Karachi","province":"Sindh","country":"Pakistan"}`
    - `{"streetAddress":"Gulshan-e-Iqbal","city":"Karachi","province":"Sindh","country":"Pakistan"}`
- `priceRange`: `3000` (can be string or number)
- `typesOfMassages`: `["Oil massage", "Aromatherapy"]` (as JSON string)
- `imageFile`: `[Select a file]` (required - must upload an image file - JPEG, PNG, GIF, or WebP, max 5MB)

**Important:** The file field name must be exactly `imageFile` (not `salonImage` or any other name)

**Note:** Use one of the addresses above - they are well-known locations in Karachi that should geocode successfully with OpenStreetMap.

**Expected Response:**
```json
{
  "success": true,
  "salon": {
    "_id": "...",
    "salonName": "Elite Relax Studio",
    ...
  }
}
```

**Save the salon `_id` - this is your `salonId`**

---

### Step 3: Create a Booking (This Creates the "User" for Recommendations)

**Endpoint:** `POST http://localhost:3000/api/v1/bookings/create-booking`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "salonId": "[salonId from Step 2]",
  "salonOwnerId": "[salonOwnerId from Step 1]",
  "firebaseUID": "test_user_123",
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "age": 28,
  "weightKg": 75,
  "requestedDateTime": "2024-12-20T15:00:00Z",
  "durationMinutes": 60
}
```

**Expected Response:**
```json
{
  "success": true,
  "booking": {
    "_id": "...",
    "status": "pending",
    ...
  }
}
```

**Save the booking `_id` - you'll need it to accept the booking**

**Note:** The `firebaseUID` (`test_user_123`) is what identifies the user for recommendations!

---

### Step 4: Accept the Booking

**Endpoint:** `POST http://localhost:3000/api/v1/bookings/patch-booking/[bookingId from Step 3]`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "status": "accepted",
  "salonOwnerId": "[salonOwnerId from Step 1]"
}
```

**Note:** Replace `[bookingId from Step 3]` in the URL with the actual booking ID.

**Expected Response:**
```json
{
  "success": true,
  "booking": {
    "_id": "...",
    "status": "accepted",
    ...
  }
}
```

**Important:** Only "accepted" bookings are used for recommendation personalization!

---

### Step 5: Test Recommendations

**Endpoint:** `GET http://localhost:3000/api/v1/recommendations/test_user_123?limit=20&latitude=24.8607&longitude=67.0011`

**Headers:**
```
Content-Type: application/json
```

**Query Parameters:**
- `limit`: `20` (optional, default: 20)
- `latitude`: `24.8607` (optional, for location-based recommendations)
- `longitude`: `67.0011` (optional, for location-based recommendations)

**Expected Response:**
```json
{
  "success": true,
  "count": 1,
  "recommendations": [
    {
      "salon": {
        "_id": "...",
        "salonName": "Elite Relax Studio",
        "location": {...},
        "priceRange": "3000",
        "typesOfMassages": ["Oil massage", "Aromatherapy"],
        "isSubscribed": false
      },
      "score": 85.5,
      "reasons": ["Offers Oil massage, Aromatherapy", "Previously visited"]
    }
  ]
}
```

---

### Step 6: Test Custom Recommendations (Optional)

**Endpoint:** `POST http://localhost:3000/api/v1/recommendations/test_user_123/custom`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "limit": 20,
  "latitude": 24.8607,
  "longitude": 67.0011,
  "preferredServices": ["Oil massage"],
  "priceRange": {
    "min": 2000,
    "max": 5000
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "count": 1,
  "recommendations": [...]
}
```

---

## Testing New User Experience (No Booking History)

**This tests the fix for new users who haven't made any bookings yet.**

### Test Case 1: New User with No Bookings

**Endpoint:** `GET http://localhost:3000/api/v1/recommendations/new_user_999?limit=20`

**Expected Behavior:**
- ✅ Returns **HTTP 200** (not 404!)
- ✅ Returns all available salons
- ✅ Includes message: `"Personalized recommendations will appear after your first accepted booking"`
- ✅ Subscribed salons appear first (boosted)
- ✅ Salons ranked by rating and subscription status

**Expected Response:**
```json
{
  "success": true,
  "count": 5,
  "message": "Personalized recommendations will appear after your first accepted booking",
  "recommendations": [
    {
      "salon": {
        "_id": "...",
        "salonName": "Elite Relax Studio",
        "location": {...},
        "priceRange": "3000",
        "typesOfMassages": ["Oil massage"],
        "isSubscribed": true
      },
      "score": 62.5,
      "reasons": ["Popular choice"]
    },
    ...
  ]
}
```

### Test Case 2: User with Booking History

**Prerequisites:** Follow Steps 1-4 above to create a booking and accept it.

**Endpoint:** `GET http://localhost:3000/api/v1/recommendations/test_user_123?limit=20&latitude=24.8607&longitude=67.0011`

**Expected Behavior:**
- ✅ Returns **HTTP 200**
- ✅ Returns personalized recommendations
- ✅ No message field (or message is undefined)
- ✅ Salons ranked by personal preferences
- ✅ Previously visited salons have higher scores

**Expected Response:**
```json
{
  "success": true,
  "count": 5,
  "recommendations": [
    {
      "salon": {
        "_id": "...",
        "salonName": "Elite Relax Studio",
        ...
        "isSubscribed": false
      },
      "score": 95.5,
      "reasons": ["Offers Oil massage", "Previously visited"]
    },
    ...
  ]
}
```

### Test Case 3: Compare Before/After

**Before the fix:**
- New user → HTTP 404 with error message
- User blocked from browsing salons

**After the fix:**
- New user → HTTP 200 with all salons
- User can browse and discover salons immediately
- Message explains personalization will improve after first booking

---

## Quick Test Script

If you want to test quickly, you can create multiple bookings with the same `firebaseUID` to build up booking history:

1. Create multiple salons (repeat Step 1 & 2)
2. Create multiple bookings with the same `firebaseUID` but different salons
3. Accept all bookings
4. Test recommendations - the algorithm will learn preferences from all accepted bookings

---

## Notes

- **firebaseUID** is the user identifier for recommendations (not stored in a separate user model)
- Only **"accepted"** bookings are used for personalization
- The algorithm learns from:
  - Preferred services (from `typesOfMassages` in booked salons)
  - Price range patterns
  - Location patterns
  - Frequently visited salons
- Subscribed salons get a +50 point boost until weekly limit (10 matches) is reached

