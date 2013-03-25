
void main (void)
{
    char results[100];
    int c;

    for (c=0; c<100; c++) {
        char result = 0;
        if (c%3 == 0) {
            result = result|1;
        }
        if (c%5 == 0) {
            result = result|2;
        }
        results[c] = result;
    }
}
