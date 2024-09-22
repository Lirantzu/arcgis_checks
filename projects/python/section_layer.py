import arcpy

# Path to your stations layer
stations_layer = r"C:\Users\x3967755\Documents\ArcGIS\Projects\Public_App\Public_App.gdb\Rakal_Kav_Sagol_Stations"

# Path to the new section layer you want to create
sections_layer = r"C:\Users\x3967755\Documents\ArcGIS\Projects\Public_App\Public_App.gdb\Rakal_Kav_Sagol_Sections"

# Create the new feature class (sections layer)
if not arcpy.Exists(sections_layer):
    spatial_ref = arcpy.Describe(stations_layer).spatialReference  # Get spatial reference from stations layer
    arcpy.CreateFeatureclass_management(out_path=r"C:\Users\x3967755\Documents\ArcGIS\Projects\Public_App\Public_App.gdb", 
                                        out_name="Rakal_Kav_Sagol_Sections", 
                                        geometry_type="MULTIPOINT",  # Use MULTIPOINT to hold multiple station points
                                        spatial_reference=spatial_ref)
    arcpy.AddField_management(sections_layer, "SectionName", "TEXT")
    print("Sections layer created.")

# Manually define which OBJECTIDs belong to which section
objectid_to_section = {
    19: "Tel-Aviv Merkaz",
    16: "Ichilov",
    1: "Ibn Gabirol",
    15: "Dizengoff",
    14: "Gordon - Idelsohn",
    13: "Gordon - Idelsohn",
    12: "Gordon - Idelsohn",
    11: "HaKarmel",
    9: "Montefiore - Allenby/Lilienblum",
    10: "Montefiore - Allenby/Lilienblum",
    8: "HaAliya - Nave Sha'anan",
    18: "HaAliya - Nave Sha'anan",
    17: "HaAliya - Nave Sha'anan",
    7: "HaHagana",
    4: "HaTikva - Moshe Dayan", 
    5: "HaTikva - Moshe Dayan",
    6: "HaTikva - Moshe Dayan",
    2: "HaMa'avak",
    3: "Kfar Shalem",
}

# Dictionary to hold stations' coordinates by section
section_stations = {}

# Use a search cursor to collect coordinates for each station based on their SectionID
with arcpy.da.SearchCursor(stations_layer, ['OBJECTID', 'SHAPE@XY']) as cursor:
    for row in cursor:
        objectid = row[0]
        if objectid in objectid_to_section:
            section_name = objectid_to_section[objectid]
            if section_name not in section_stations:
                section_stations[section_name] = []
            section_stations[section_name].append(row[1])  # Store station coordinates (XY)

# Insert a new feature for each section in the new layer
with arcpy.da.InsertCursor(sections_layer, ['SHAPE@', 'SectionName']) as cursor:
    for section, coords in section_stations.items():
        # Create a multipoint geometry from the coordinates of the stations
        multipoint_geometry = arcpy.Multipoint(arcpy.Array([arcpy.Point(xy[0], xy[1]) for xy in coords]))
        
        # Insert the multipoint as a new feature in the sections layer
        cursor.insertRow([multipoint_geometry, section])
        print(f"Inserted section {section} with {len(coords)} stations.")

print("Section layer creation completed.")
