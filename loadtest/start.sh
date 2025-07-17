#!/bin/sh

# Get all yml files except docker-compose.yml and store in a temp file
ls *.yml | grep -v docker-compose.yml > /tmp/yml_files.txt

# Count the number of files
file_count=$(wc -l < /tmp/yml_files.txt)

# Generate random line number (1 to file_count)
random_line=$(($(dd if=/dev/urandom bs=2 count=1 2>/dev/null | od -An -N2 -i) % file_count + 1))

# Select the file at the random line
selected_file=$(sed -n "${random_line}p" /tmp/yml_files.txt)

echo "Available Artillery config files:"
cat /tmp/yml_files.txt
echo "Randomly selected: ${selected_file}"

# Run artillery with the selected file
artillery run "${selected_file}"