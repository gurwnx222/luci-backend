# Postman Testing Guide for Private Massager API

## Prerequisites
- Server running on `http://localhost:3000` (or your configured PORT)
- MongoDB connected
- An existing owner profile (created via `/api/v1/register/register-salon-owner`)

## Base URL
```
http://localhost:3000/api/private-massagers
```

---

## Step-by-Step Testing

### Step 1: Register an Owner (Prerequisites)

**Endpoint:** `POST http://localhost:3000/api/v1/register/register-salon-owner`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "salonOwnerName": "Jane Smith",
  "salonOwnerEmail": "jane.smith@example.com"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "salonOwnerName": "Jane Smith",
    "salonOwnerEmail": "jane.smith@example.com",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Save the `ownerEmail` and `ownerName` - you'll need them for the next step**

---

### Step 2: Create a Private Massager Profile

**Endpoint:** `POST http://localhost:3000/api/private-massagers`

**Headers:**
```
Content-Type: multipart/form-data
```

**Body (form-data):**

| Key | Type | Value | Required |
|-----|------|-------|----------|
| `ownerEmail` | Text | `jane.smith@example.com` | ✅ Yes |
| `ownerName` | Text | `Jane Smith` | ✅ Yes |
| `height` | Text | `170` | ❌ No (in cm, 0-300) |
| `weight` | Text | `65` | ❌ No (in kg, 0-300) |
| `aboutMe` | Text | `Experienced massage therapist specializing in Thai massage and deep tissue work.` | ❌ No |
| `occupation` | Text | `Massage Therapist` | ❌ No |
| `gender` | Text | `Female` | ❌ No (enum: Male, Female, Others) |
| `subscriptionID` | Text | (optional MongoDB ObjectId) | ❌ No |
| `imageFiles` | File | Select image file(s) | ❌ No (but recommended) |

**Important Notes:**
- The file field name must be exactly **`imageFiles`** (plural)
- You can upload **multiple files** (up to 10 files)
- First file becomes the `profilePhoto`, remaining files are added to `photos` array
- Supported image formats: JPEG, JPG, PNG, GIF, WebP
- Max file size: 5MB per file

**Example form-data (with single file):**
```
ownerEmail: jane.smith@example.com
ownerName: Jane Smith
height: 170
weight: 65
aboutMe: Experienced massage therapist specializing in Thai massage and deep tissue work.
occupation: Massage Therapist
gender: Female
imageFiles: [Select File] profile-photo.jpg
```

**Example form-data (with multiple files):**
```
ownerEmail: jane.smith@example.com
ownerName: Jane Smith
height: 170
weight: 65
aboutMe: Experienced massage therapist specializing in Thai massage and deep tissue work.
occupation: Massage Therapist
gender: Female
imageFiles: [Select File] profile-photo.jpg
imageFiles: [Select File] photo2.jpg
imageFiles: [Select File] photo3.jpg
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Private massager profile created and linked to your account successfully",
  "data": {
    "privateMassager": {
      "_id": "507f1f77bcf86cd799439011",
      "ownerId": "507f191e810c19729de860ea",
      "profilePhoto": "https://ik.imagekit.io/youraccount/profile-photo-123.jpg",
      "photos": [
        "https://ik.imagekit.io/youraccount/photo2-456.jpg",
        "https://ik.imagekit.io/youraccount/photo3-789.jpg"
      ],
      "height": 170,
      "weight": 65,
      "aboutMe": "Experienced massage therapist specializing in Thai massage and deep tissue work.",
      "occupation": "Massage Therapist",
      "gender": "Female",
      "subscriptionID": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "ownerId": "507f191e810c19729de860ea",
    "ownerEmail": "jane.smith@example.com",
    "ownerName": "Jane Smith"
  }
}
```

**Save the `_id` from `privateMassager` - this is your `privateMassagerId`**

---

### Step 3: Get All Private Massagers (Paginated)

**Endpoint:** `GET http://localhost:3000/api/private-massagers?limit=10&page=1`

**Headers:**
```
Content-Type: application/json
```

**Query Parameters:**
- `limit` (optional): Number of results per page (default: 10)
- `page` (optional): Page number (default: 1)

**Example:**
```
GET http://localhost:3000/api/private-massagers?limit=5&page=1
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Private massagers fetched successfully",
  "count": 5,
  "total": 10,
  "page": 1,
  "totalPages": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "profilePhoto": "https://ik.imagekit.io/youraccount/profile-photo-123.jpg",
      "photos": ["https://ik.imagekit.io/youraccount/photo2-456.jpg"],
      "height": 170,
      "weight": 65,
      "aboutMe": "Experienced massage therapist...",
      "occupation": "Massage Therapist",
      "gender": "Female",
      "ownerId": "507f191e810c19729de860ea",
      "subscriptionID": null
    },
    ...
  ]
}
```

---

### Step 4: Get Single Private Massager by ID

**Endpoint:** `GET http://localhost:3000/api/private-massagers/{privateMassagerId}`

**Headers:**
```
Content-Type: application/json
```

**Example:**
```
GET http://localhost:3000/api/private-massagers/507f1f77bcf86cd799439011
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Private massager profile fetched successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "profilePhoto": "https://ik.imagekit.io/youraccount/profile-photo-123.jpg",
    "photos": [
      "https://ik.imagekit.io/youraccount/photo2-456.jpg",
      "https://ik.imagekit.io/youraccount/photo3-789.jpg"
    ],
    "height": 170,
    "weight": 65,
    "aboutMe": "Experienced massage therapist specializing in Thai massage and deep tissue work.",
    "occupation": "Massage Therapist",
    "gender": "Female",
    "ownerId": "507f191e810c19729de860ea",
    "subscriptionID": null
  }
}
```

**Expected Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Private massager profile not found"
}
```

**Expected Error Response (400 Bad Request - Invalid ID):**
```json
{
  "success": false,
  "message": "Invalid private massager ID format"
}
```

---

### Step 5: Update Private Massager Profile

**Endpoint:** `PUT http://localhost:3000/api/private-massagers/{privateMassagerId}`

**Headers:**
```
Content-Type: multipart/form-data
```

**Body (form-data):**

| Key | Type | Value | Required |
|-----|------|-------|----------|
| `height` | Text | `175` | ❌ No |
| `weight` | Text | `68` | ❌ No |
| `aboutMe` | Text | `Updated bio text...` | ❌ No |
| `occupation` | Text | `Senior Massage Therapist` | ❌ No |
| `gender` | Text | `Female` | ❌ No |
| `subscriptionID` | Text | (MongoDB ObjectId) | ❌ No |
| `imageFiles` | File | Select image file(s) | ❌ No |

**Important Notes:**
- Only include fields you want to update
- New photos will be **appended** to the existing `photos` array
- First file in `imageFiles` will update `profilePhoto`
- Remaining files will be added to `photos` array

**Example form-data:**
```
height: 175
weight: 68
aboutMe: Updated bio - Now specializing in deep tissue and sports massage.
imageFiles: [Select File] new-photo.jpg
```

**Example Request:**
```
PUT http://localhost:3000/api/private-massagers/507f1f77bcf86cd799439011
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Private massager profile updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "profilePhoto": "https://ik.imagekit.io/youraccount/new-photo-123.jpg",
    "photos": [
      "https://ik.imagekit.io/youraccount/photo2-456.jpg",
      "https://ik.imagekit.io/youraccount/photo3-789.jpg",
      "https://ik.imagekit.io/youraccount/new-photo-123.jpg"
    ],
    "height": 175,
    "weight": 68,
    "aboutMe": "Updated bio - Now specializing in deep tissue and sports massage.",
    "occupation": "Massage Therapist",
    "gender": "Female",
    "ownerId": "507f191e810c19729de860ea",
    "subscriptionID": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:45:00.000Z"
  }
}
```

---

### Step 6: Delete Private Massager Profile

**Endpoint:** `DELETE http://localhost:3000/api/private-massagers/{privateMassagerId}`

**Headers:**
```
Content-Type: application/json
```

**Example:**
```
DELETE http://localhost:3000/api/private-massagers/507f1f77bcf86cd799439011
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Private massager profile deleted successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "profilePhoto": "https://ik.imagekit.io/youraccount/profile-photo-123.jpg",
    "photos": [...],
    "height": 170,
    "weight": 65,
    ...
  }
}
```

**Expected Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Private massager profile not found"
}
```

---

## Common Error Responses

### 400 Bad Request - Owner Not Found
```json
{
  "success": false,
  "message": "Owner not found with the provided email and name. Please ensure you are registered first."
}
```

**Solution:** Make sure the owner is registered first using `/api/v1/register/register-salon-owner`

### 400 Bad Request - Owner Already Has Profile
```json
{
  "success": false,
  "message": "This owner already has a private massager profile. Each owner can only create one profile.",
  "existingProfileId": "507f1f77bcf86cd799439011"
}
```

**Solution:** Use the update endpoint instead, or delete the existing profile first

### 400 Bad Request - Invalid Gender
```json
{
  "success": false,
  "message": "Gender must be one of: Male, Female, Others"
}
```

**Solution:** Use one of the valid gender values: `Male`, `Female`, or `Others`

### 400 Bad Request - Invalid Height/Weight
```json
{
  "success": false,
  "message": "Height must be a number between 0 and 300 cm"
}
```

**Solution:** Ensure height is between 0-300 cm and weight is between 0-300 kg

### 500 Internal Server Error - Image Upload Failed
```json
{
  "success": false,
  "message": "Failed to upload image to storage",
  "error": "..." // Only in development mode
}
```

**Solution:** Check ImageKit configuration and ensure image files are valid

---

## Testing Tips

### 1. Testing File Uploads
- Use **form-data** in Postman (not raw JSON)
- Click "Body" → Select "form-data"
- Add text fields first, then add file field(s)
- For multiple files, add multiple `imageFiles` fields with the same key name

### 2. Testing Without Files
- You can create/update a profile without images
- Simply omit the `imageFiles` field
- Images can be added later via update endpoint

### 3. Testing Validation
- Try creating a profile with invalid email format
- Try with height > 300 or weight > 300
- Try with invalid gender value
- Try creating duplicate profile for same owner

### 4. Testing Pagination
- Test with different `limit` values (1, 5, 10, 20)
- Test with different `page` values
- Verify `totalPages` calculation is correct

### 5. Testing Update Scenarios
- Update only one field (e.g., just `height`)
- Update multiple fields at once
- Add new photos to existing profile
- Update subscriptionID

---

## Complete Workflow Example

1. **Register Owner:**
   ```
   POST /api/v1/register/register-salon-owner
   Body: { "salonOwnerName": "Jane Smith", "salonOwnerEmail": "jane.smith@example.com" }
   ```

2. **Create Private Massager:**
   ```
   POST /api/private-massagers
   Form-data: ownerEmail, ownerName, height, weight, aboutMe, occupation, gender, imageFiles
   ```

3. **Get All Massagers:**
   ```
   GET /api/private-massagers?limit=10&page=1
   ```

4. **Get Single Massager:**
   ```
   GET /api/private-massagers/{id}
   ```

5. **Update Massager:**
   ```
   PUT /api/private-massagers/{id}
   Form-data: height, weight, aboutMe, imageFiles
   ```

6. **Delete Massager (optional):**
   ```
   DELETE /api/private-massagers/{id}
   ```

---

## Integration with Subscriptions

To link a subscription to a private massager, you can:

1. **Create subscription first:**
   ```
   POST /api/v1/subscriptions/create
   Body: {
     "ownerEmail": "jane.smith@example.com",
     "ownerName": "Jane Smith",
     "planType": "Basic",
     "billingCycle": "Monthly",
     "subscriptionType": "PrivateMassager",
     "paymentMethodId": "..."
   }
   ```

2. **Get subscription ID from response**

3. **Update private massager with subscriptionID:**
   ```
   PUT /api/private-massagers/{id}
   Form-data: subscriptionID: {subscriptionId}
   ```

Or include `subscriptionID` directly when creating the private massager profile.

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Image URLs are stored after upload to ImageKit
- Each owner can only have **one** private massager profile
- Height is in **centimeters** (cm)
- Weight is in **kilograms** (kg)
- Gender field accepts: `Male`, `Female`, `Others`
- Profile photos are stored separately from the `photos` array
- Maximum 10 files can be uploaded at once
- File size limit: 5MB per file

