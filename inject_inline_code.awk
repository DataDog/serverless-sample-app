# Unless explicitly stated otherwise all files in this repository are licensed
# under the Apache License Version 2.0.
# This product includes software developed at Datadog (https://www.datadoghq.com/).
# Copyright 2022 Datadog, Inc.

NR==FNR {
    rec[++numLines] = $0
    next
}
s = index($0,STRING_TO_REPLACE) {
    indent = sprintf("%*s",s-1,"")
    for (lineNr=1; lineNr<=numLines; lineNr++) {
        print indent rec[lineNr]
    }
    next
}
{ print }