import arcpy

# Define the path to your layer
metro_station_layer = r"C:\Users\x3967755\Documents\ArcGIS\Projects\Public_App\Public_App.gdb\Rakal_Kav_Yarok_Stations"  # Update with your actual file path

# Step 1: Add a new field for section names
field_name = "Section"
field_type = "TEXT"
field_length = 50  # Adjust the length as needed

# Check if field already exists
fields = [f.name for f in arcpy.ListFields(metro_station_layer)]
if field_name not in fields:
    arcpy.AddField_management(metro_station_layer, field_name, field_type, field_length=field_length)

# Step 2: Update the field values based on metro station names
# Define the sections and station groups (adjust this according to your logic)
sections = {
    "Unichman - Azore Hen": ["Unichman", "Miriam Yalan-Shteklis", "Miriam Ben-Porat", "Shoshanna Parsitz", "Azore Hen"],
    "Propes - Einstein": ["Propes", "HaGush HaGadol", "Station 6", "Einstein"],
    # Add more sections and station groups as needed
}

# Step 3: Use an update cursor to assign section names to the new field
with arcpy.da.UpdateCursor(metro_station_layer, ["station_name_ENG", field_name]) as cursor:
    for row in cursor:
        station_name = row[0]
        # Check which section the station belongs to
        for section, station_list in sections.items():
            if station_name in station_list:
                row[1] = section  # Assign section name to the new field
                cursor.updateRow(row)
                break
