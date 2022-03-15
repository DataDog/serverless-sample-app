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