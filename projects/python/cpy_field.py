
import arcpy

# Define the source and target feature classes
source_layer = r"C:\Users\x3967755\Documents\ArcGIS\Projects\Public_App\Public_App.gdb\Rakal_Kav_Yarok_Sections1"
target_layer = r"C:\Users\x3967755\Documents\ArcGIS\Projects\Public_App\Public_App.gdb\Rakal_Kav_Yarok_Sections"

# Define the field names
image_field = "image"
name_field = "SectionName"  # Replace with your actual name field

# Create a dictionary to store the image URLs from the source layer
image_dict = {}

# Read the image URLs from the source layer
with arcpy.da.SearchCursor(source_layer, [name_field, image_field]) as cursor:
    for row in cursor:
        image_dict[row[0]] = row[1]

# Update the target layer with the image URLs
updated_count = 0
with arcpy.da.UpdateCursor(target_layer, [name_field, image_field]) as cursor:
    for row in cursor:
        if row[0] in image_dict:
            row[1] = image_dict[row[0]]
            cursor.updateRow(row)
            updated_count += 1
        else:
            print(f"No matching name found for {row[0]}")

print(f"Image URLs have been copied for {updated_count} features from the source layer to the target layer.")