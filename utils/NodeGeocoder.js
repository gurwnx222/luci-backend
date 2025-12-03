import NodeGeocoder from "node-geocoder";

// Configure NodeGeocoder
const options = {
  provider: "openstreetmap", // Use OpenStreetMap (Nominatim)
  httpAdapter: "https",
  formatter: null,
};

const geocoder = NodeGeocoder(options);

export async function geocodeAddress(location) {
  try {
    let query;

    if (typeof location === "object") {
      const { streetAddress, city, province, country } = location;
      const parts = [streetAddress, city, province, country].filter(Boolean);
      query = parts.join(", ");
    } else {
      throw new Error("Expected object but got another data type!");
    }
    const results = await geocoder.geocode(query);

    if (results.length > 0) {
      const location = results[0];
      console.log("Address:", location.formattedAddress);
      console.log("Latitude:", location.latitude);
      console.log("Longitude:", location.longitude);
      console.log("Country:", location.country);
      console.log("City:", location.city);
      console.log("---");

      return {
        latitude: location.latitude,
        longitude: location.longitude,
        formattedAddress: location.formattedAddress,
      };
    } else {
      console.log("No results found for:", query);
      throw new Error(`No geocoding results found for address: ${query}`);
    }
  } catch (error) {
    console.log("Error geo coding the salon address: ", error.message);
    throw error;
  }
}
