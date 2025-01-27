resource "aws_vpc" "vpc" {
    cidr_block              = "10.0.0.0/16"
    enable_dns_hostnames    = true
    enable_dns_support      = true
}

resource "aws_internet_gateway" "igw" {
    vpc_id                  = aws_vpc.vpc.id
}

resource "aws_nat_gateway" "ngw" {
    allocation_id           = aws_eip.nateip.id
    subnet_id               = aws_subnet.public_subnet_1.id
    depends_on              = [ aws_internet_gateway.igw ]
}

resource "aws_eip" "nateip" {
    domain                  = "vpc"
}

resource "aws_subnet" "private_subnet_1" {
    vpc_id                  = aws_vpc.vpc.id
    cidr_block              = "10.0.80.0/20"
    availability_zone       = "${var.region}a"
}

resource "aws_subnet" "private_subnet_2" {
    vpc_id                  = aws_vpc.vpc.id
    cidr_block              = "10.0.112.0/20"
    availability_zone       = "${var.region}b"
}

resource "aws_subnet" "public_subnet_1" {
    vpc_id                  = aws_vpc.vpc.id
    cidr_block              = "10.0.16.0/20"
    availability_zone       = "${var.region}a"
    map_public_ip_on_launch = true
}

resource "aws_subnet" "public_subnet_2" {
    vpc_id                  = aws_vpc.vpc.id
    cidr_block              = "10.0.32.0/20"
    availability_zone       = "${var.region}b"
    map_public_ip_on_launch = true
}

resource "aws_route_table" "public" {
    vpc_id                  = aws_vpc.vpc.id
    
}

resource "aws_route" "public" {
    route_table_id          = aws_route_table.public.id
    destination_cidr_block  = "0.0.0.0/0"
    gateway_id              = aws_internet_gateway.igw.id
}

resource "aws_route_table_association" "public1" {
    subnet_id               = aws_subnet.public_subnet_1.id
    route_table_id          = aws_route_table.public.id
}
resource "aws_route_table_association" "public2" {
    subnet_id               = aws_subnet.public_subnet_2.id
    route_table_id          = aws_route_table.public.id
}

resource "aws_route_table" "private" {
    vpc_id                  = aws_vpc.vpc.id
}
  
resource "aws_route" "private" {
    route_table_id          = aws_route_table.private.id
    destination_cidr_block  = "0.0.0.0/0"
    nat_gateway_id          = aws_nat_gateway.ngw.id
}

resource "aws_route_table_association" "private1" {
    subnet_id               = aws_subnet.private_subnet_1.id
    route_table_id          = aws_route_table.private.id
}

resource "aws_route_table_association" "private2" {
    subnet_id               = aws_subnet.private_subnet_2.id
    route_table_id          = aws_route_table.private.id
}