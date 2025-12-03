import NodeGeocoder from "node-geocoder";
//configure NodeGeocoder
const options = {
  provider: "openstreetmap", // Use OpenStreetMap (Nominatim)
  httpAdapter: "https",
  formatter: null,
};
const geocoder = NodeGeocoder(options);
export async function geocodeAddress(streetAddress) {
  try {
    const res = await geocoder.geocode(streetAddress);
    if (!res) console.log("Address not provided !!");
    console.log("Geocoded address: ", res);
  } catch (error) {
    console.log("Error geo coding the salon address: ", error.message);
    return res.status(500).json({
      message: "Error geo coding the salon address",
      error: error,
    });
  }
}
