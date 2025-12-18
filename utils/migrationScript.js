// scripts/migrateSalonOwnerIds.js

import mongoose from "mongoose";
import {
  SalonProfileSchemaModel,
  UserProfileSchemaModel,
} from "../models/index.js";
import dotenv from "dotenv";
import connectDB from "../db/index.js";

dotenv.config();

/**
 * Migration script to add ownerId to existing salon profiles
 * Run this once after updating your schema
 *
 * Usage: node scripts/migrateSalonOwnerIds.js
 */
const migrateSalonOwnerIds = async () => {
  try {
    console.log("Starting migration...");
    console.log("Connecting to database...");

    await connectDB();
    console.log("Connected to database");

    // Find all salons without ownerId
    const salonsWithoutOwner = await SalonProfileSchemaModel.find({
      ownerId: { $exists: false },
    });

    console.log(`Found ${salonsWithoutOwner.length} salons without ownerId`);

    if (salonsWithoutOwner.length === 0) {
      console.log("No salons need migration");
      await mongoose.connection.close();
      return;
    }

    let updated = 0;
    let failed = 0;
    const errors = [];

    // For each salon, find its owner and update
    for (const salon of salonsWithoutOwner) {
      try {
        // Find owner who has this salon's ID in their salonProfileId
        const owner = await UserProfileSchemaModel.findOne({
          salonProfileId: salon._id,
        });

        if (owner) {
          // Update salon with ownerId
          await SalonProfileSchemaModel.updateOne(
            { _id: salon._id },
            { $set: { ownerId: owner._id } }
          );

          console.log(
            `Updated salon "${salon.salonName}" with owner "${owner.salonOwnerName}"`
          );
          updated++;
        } else {
          console.log(
            `No owner found for salon "${salon.salonName}" (ID: ${salon._id})`
          );
          errors.push({
            salonId: salon._id,
            salonName: salon.salonName,
            reason: "No owner found with this salon's ID",
          });
          failed++;
        }
      } catch (error) {
        console.error(
          `Error updating salon "${salon.salonName}":`,
          error.message
        );
        errors.push({
          salonId: salon._id,
          salonName: salon.salonName,
          reason: error.message,
        });
        failed++;
      }
    }

    console.log("\n Migration Summary:");
    console.log(`Successfully updated: ${updated} salons`);
    console.log(`Failed: ${failed} salons`);

    if (errors.length > 0) {
      console.log("\n Salons that couldn't be migrated:");
      console.table(errors);
      console.log(
        "\nThese salons need manual intervention. They may be orphaned records."
      );
    }

    await mongoose.connection.close();
    console.log("\n Migration completed");
  } catch (error) {
    console.error("Migration failed:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run migration
migrateSalonOwnerIds();
